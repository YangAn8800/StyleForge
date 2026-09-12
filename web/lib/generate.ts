import { getStyle } from "@/lib/styles";

/**
 * 生成服务: /api/generate 为异步任务模式——POST 秒回 jobId，随后轮询
 * GET /api/generate?job=xxx 直到完成。（直接长 POST 会被 Cloudflare 边缘
 * ~100s 超时截断：前端报"生成失败"但服务端其实继续生成并入库。）
 * 未配置 key 或任务失败时回退到 mock(该风格样例图), 保证网站永远可用。
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AspectRatio = "3:4" | "1:1" | "16:9";

/** 比例 → gpt-image 系列支持的 size（提示词内的版式描述不受影响） */
export const ASPECT_SIZES: Record<AspectRatio, string> = {
  "3:4": "1024x1536",
  "1:1": "1024x1024",
  "16:9": "1536x1024",
};

const POLL_MS = 2500;
/* 中转站偶发极慢（实测有一笔 5-6 分钟才出图，图最后是成功的）。分段轮询：
 * 前 4 分钟每 2.5s 一次；之后放慢到 6s 一直等到 15 分钟——与服务端任务
 * TTL 一致，超过才报 timeout（此前 4 分钟就放弃，导致"前端失败、稍后
 * 图片却出现在我的作品"）。 */
const POLL_DEADLINE = 15 * 60 * 1000;
const POLL_FAST_UNTIL = 4 * 60 * 1000;
const POLL_SLOW_MS = 6000;
const POST_RETRIES = 3;

interface GenerateResponse {
  fallback?: boolean;
  jobId?: string;
  imageUrl?: string;
  thumbUrl?: string;
  error?: string;
}

export type GenerateResult = {
  imageUrl: string;
  real: boolean;
  notice?: string;
  thumbUrl?: string;
  /** 请求根本没送达（网络问题，任务未开始）→ UI 可以放心提供「重试」 */
  retryable?: boolean;
};

/**
 * POST /api/generate。公网走 Cloudflare 隧道时实测约 25% 的请求会 SSL EOF /
 * 握手超时，所以这里重试；clientId 幂等键保证重试不会重复生图（不重复扣费）。
 */
async function postGenerate(payload: {
  styleId: string;
  prompt?: string;
  photo: string;
  size: string;
  clientId: string;
}): Promise<{ status: number; data: GenerateResponse }> {
  let lastErr: unknown = new Error("请求失败");
  for (let attempt = 0; attempt < POST_RETRIES; attempt++) {
    if (attempt > 0) await sleep(700 * attempt);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      try {
        return { status: res.status, data: JSON.parse(text) as GenerateResponse };
      } catch {
        // 服务端自己的响应一定是 JSON；解析失败说明被网关截断/替换 → 值得重试
        lastErr = new Error(`响应不是 JSON (HTTP ${res.status})`);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("网络请求失败");
}

/**
 * 拆分出来的提交/轮询步骤，给 run-manager 用：
 *   submitJob → jobId（秒回）；
 *   pollJob   → 拿到 imageUrl / 抛 "unknown"（服务端任务表里已没了，重提用）。
 * generateImage 是给上层不需拆分的场景（如手机端单图生成）的便捷封装。
 */
export async function submitJob(opts: {
  styleId?: string;
  prompt?: string;
  photo: string;
  size: string;
  /** 不传则本函数生成一个（每次 submitJob 调用 = 一次新的任务请求） */
  clientId?: string;
}): Promise<{ jobId: string; data: GenerateResponse }> {
  const clientId =
    opts.clientId ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const { status, data } = await postGenerate({
    styleId: opts.styleId ?? "",
    prompt: opts.prompt,
    photo: opts.photo,
    size: opts.size,
    clientId,
  });
  if (status >= 200 && status < 300) {
    if (data.fallback) throw new Error("未配置 OPENAI_API_KEY");
    if (!data.jobId) throw new Error("no_job_id");
    return { jobId: data.jobId, data };
  }
  throw new Error(data.error ?? `submit failed (${status})`);
}

export type PollResult = { imageUrl: string; thumbUrl?: string };

export async function pollJob(jobId: string, deadlineMs = POLL_DEADLINE): Promise<PollResult> {
  const deadline = Date.now() + deadlineMs;
  const start = Date.now();
  while (Date.now() < deadline) {
    await sleep(Date.now() - start < POLL_FAST_UNTIL ? POLL_MS : POLL_SLOW_MS);
    let s: { status?: string; imageUrl?: string; thumbUrl?: string; error?: string } | null = null;
    try {
      const sr = await fetch(`/api/generate?job=${encodeURIComponent(jobId)}`);
      s = await sr.json();
    } catch {
      /* 单次轮询失败继续 */
    }
    if (s?.status === "done" && s.imageUrl) {
      return { imageUrl: s.imageUrl, thumbUrl: s.thumbUrl };
    }
    if (s?.status === "error") throw new Error(s.error ?? "生成失败");
    if (s?.status === "unknown") throw new Error("unknown");
  }
  throw new Error("timeout");
}

export async function generateImage(
  opts: { styleId: string; prompt?: string },
  photoDataUrl: string,
  aspect: AspectRatio = "3:4",
): Promise<GenerateResult> {
  const { styleId, prompt } = opts;
  const style = getStyle(styleId);
  if (!style && !prompt) throw new Error("未知风格且未提供提示词");

  try {
    const { jobId } = await submitJob({
      styleId,
      prompt,
      photo: photoDataUrl,
      size: ASPECT_SIZES[aspect],
    });
    const r = await pollJob(jobId);
    return { imageUrl: r.imageUrl, thumbUrl: r.thumbUrl, real: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 自定义提示词无对应风格 + 任何失败 → 直接抛错（不能回退到样例图）
    if (!style) {
      if (msg === "未配置 OPENAI_API_KEY") {
        throw new Error("未配置 OPENAI_API_KEY，自定义提示词无法生成");
      }
      throw e;
    }
    // 有风格：任何提交/轮询失败都回退到该风格的样例图，带诚实文案 + retryable
    const notice =
      msg === "unknown"
        ? "服务重启导致任务状态丢失，生成可能已完成——请到「我的作品」查看"
        : msg === "timeout"
          ? "生成时间过长，可能仍在后台进行——请稍后到「我的作品」查看结果"
          : msg === "未配置 OPENAI_API_KEY"
            ? "未配置 OPENAI_API_KEY，展示的是样例图"
            : msg === "no_job_id" || msg === "submit failed (502)" || msg.startsWith("submit failed")
              ? `生成请求被拒（${msg}），已回退样例图`
              : msg === "网络请求失败" || msg === "请求失败" || msg === "响应不是 JSON (HTTP 0)"
                ? "网络不稳定，生成请求未送达（尚未开始生成）—— 请点「重试」"
                : `生成失败，已回退样例图（${msg}）`;
    return { ...(await mock(styleId)), real: false, retryable: true, notice };
  }
}

async function mock(styleId: string): Promise<{ imageUrl: string }> {
  await sleep(1200 + Math.random() * 900);
  const style = getStyle(styleId);
  const imgs = style?.images ?? [];
  if (imgs.length === 0) throw new Error("该风格没有样例图");
  return { imageUrl: imgs[Math.floor(Math.random() * imgs.length)] };
}
