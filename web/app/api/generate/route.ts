/**
 * 反向代理: /api/generate（异步任务模式）
 *
 * 背景: 中转站生图需 50–110s，超过 Cloudflare 边缘 ~100s 超时——长请求会被
 * 边缘截断返回错误，但服务端其实继续生成并落盘（用户看到"生成失败"却在他
 * 的作品里出现图片）。因此改为:
 *   POST /api/generate          → 校验后立即返回 { jobId }（202，秒回不超时）
 *   GET  /api/generate?job=xxx  → 轮询任务状态 { status: pending|done|error, ... }
 * 后台任务在 Node 进程内继续跑，完成后图片落盘 + 写画廊台账。
 * 未配置 key 时 POST 仍返回 { fallback: true }，前端回退样例图。
 */
import { NextRequest, NextResponse } from "next/server";
import { fetch as undiciFetch, ProxyAgent, FormData } from "undici";
// undici 的 FormData.append 接受全局 Blob（Node 18+ 内置），无需从 undici 导入 Blob
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { getStyle } from "@/lib/styles";

export const runtime = "nodejs";
export const maxDuration = 300; // 后台任务本身不受路由响应时限影响，此值尽量放宽

const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
// 本地代理（如 Clash http://127.0.0.1:7897），不填则直连
const PROXY_URL = process.env.OPENAI_PROXY_URL || "";

interface GenerateBody {
  styleId?: string;
  prompt?: string; // compose 页拼装的自定义提示词（与 styleId 二选一）
  photo?: string; // data URL: data:image/jpeg;base64,....
  size?: string; // 1024x1536 | 1024x1024 | 1536x1024（比例选择，不改动提示词）
  clientId?: string; // 客户端幂等键：网络抖动下前端重试同一张图不会重复生成
}

const ALLOWED_SIZES = new Set(["1024x1536", "1024x1024", "1536x1024"]);

/* ---------- 任务表（单进程内存即可，next start 不多进程） ---------- */
interface Job {
  status: "pending" | "done" | "error";
  imageUrl?: string;
  thumbUrl?: string;
  error?: string;
  ts: number;
}
const jobs = new Map<string, Job>();
// clientId → jobId：弱网下前端会重发同一个请求，命中即复用任务（不重复生图、不重复扣费）
const clientJobs = new Map<string, string>();
const JOB_TTL = 15 * 60 * 1000;

function purgeOldJobs() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.ts > JOB_TTL) jobs.delete(id);
  }
  for (const [cid, jid] of clientJobs) {
    if (!jobs.has(jid)) clientJobs.delete(cid);
  }
}

export async function GET(req: NextRequest) {
  const job = new URL(req.url).searchParams.get("job");
  if (!job) {
    return NextResponse.json({ error: "缺少 job 参数" }, { status: 400 });
  }
  const j = jobs.get(job);
  if (!j) {
    // 任务不存在（服务重启过或已过期）
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }
  return NextResponse.json(j);
}

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { fallback: true, reason: "未配置 OPENAI_API_KEY" },
      { status: 200 },
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const { styleId, prompt, photo, size, clientId } = body;
  const style = styleId ? getStyle(styleId) : undefined;

  // 公开白名单：data/public-styles.json（本机收藏导出）。
  // 白名单内风格对公网开放；白名单外风格与自定义 prompt 仅限本机（localhost Origin/Host）。
  if (styleId || prompt) {
    let publicIds: string[] = [];
    try {
      publicIds = JSON.parse(
        await readFile(path.join(process.cwd(), "data", "public-styles.json"), "utf-8"),
      ) as string[];
    } catch {
      publicIds = [];
    }
    const inPublic = !styleId || publicIds.includes(styleId);
    if (!inPublic || prompt) {
      const origin = (req.headers.get("origin") ?? "").toLowerCase();
      const host = (req.headers.get("host") ?? "").toLowerCase();
      const isLocal =
        origin.includes("//localhost") || origin.includes("//127.0.0.1") ||
        host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
      if (!isLocal) {
        return NextResponse.json(
          { error: "该风格未开放，请在公开风格列表中选择" },
          { status: 403 },
        );
      }
    }
  }

  // 提示词来源：风格库模板 或 自定义拼装（prompt 直传）
  const finalPrompt =
    style?.prompt ?? (prompt && prompt.trim().length >= 20 ? prompt.trim() : undefined);
  if (!finalPrompt) {
    return NextResponse.json({ error: "未知风格，或提示词过短（<20字）" }, { status: 400 });
  }
  const m = photo?.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) {
    return NextResponse.json(
      { error: "photo 需要是 image data URL" },
      { status: 400 },
    );
  }
  const [, mime, b64] = m;

  // 立即派发后台任务并秒回 jobId（避免 Cloudflare 边缘 ~100s 超时截断）
  purgeOldJobs();
  // 重试幂等：同一 clientId 已有任务则直接复用（前端可能在弱网下重发）
  if (clientId) {
    const existing = clientJobs.get(clientId);
    if (existing && jobs.has(existing)) {
      return NextResponse.json({ jobId: existing, reused: true }, { status: 202 });
    }
  }
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: "pending", ts: Date.now() });
  if (clientId) clientJobs.set(clientId, jobId);
  void runGeneration(jobId, {
    key,
    finalPrompt,
    styleId: styleId ?? "custom",
    styleName: style?.name ?? "自定义拼装",
    mime,
    photoBuf: Buffer.from(b64, "base64"),
    size: ALLOWED_SIZES.has(size ?? "") ? size! : "1024x1536",
  }).catch((e) => {
    console.log(
      "[generate] 任务失败:",
      jobId,
      e instanceof Error ? e.message : e,
    );
    jobs.set(jobId, {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      ts: Date.now(),
    });
  });

  return NextResponse.json({ jobId }, { status: 202 });
}

/* ---------- 后台生成（不占用请求响应通道） ---------- */
async function runGeneration(
  jobId: string,
  p: {
    key: string;
    finalPrompt: string;
    styleId: string;
    styleName: string;
    mime: string;
    photoBuf: Buffer;
    size: string;
  },
) {
  const ext = p.mime.includes("png") ? "png" : p.mime.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("model", MODEL);
  form.append("image", new Blob([new Uint8Array(p.photoBuf)], { type: p.mime }), `photo.${ext}`);
  form.append("prompt", p.finalPrompt);
  form.append("size", p.size);
  form.append("quality", "medium");

  const agent = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;
  const r = await undiciFetch(`${OPENAI_BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}` },
    body: form as unknown as never,
    ...(agent ? { dispatcher: agent } : {}),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`上游 ${r.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await r.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = data.data?.[0];
  let imageBuf: Buffer | undefined;
  let imageMime = "image/png";
  if (item?.b64_json) {
    imageBuf = Buffer.from(item.b64_json, "base64");
  } else if (item?.url) {
    // 中转站返回临时 URL → 服务端立即取回，落盘后返回静态路径
    const imgRes = await undiciFetch(item.url, agent ? { dispatcher: agent } : {});
    if (!imgRes.ok) {
      throw new Error(`图片回取失败 ${imgRes.status}`);
    }
    imageBuf = Buffer.from(await imgRes.arrayBuffer());
    imageMime = imgRes.headers.get("content-type")?.split(";")[0] || "image/png";
  }
  if (!imageBuf) {
    throw new Error("上游未返回图片数据");
  }

  // 落盘到 public/generated/ → 前端拿到的 URL 刷新后依然有效（生成历史的基础）
  const outExt = imageMime.includes("jpeg") ? "jpg" : imageMime.includes("webp") ? "webp" : "png";
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dir = path.join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const filename = `${stamp}.${outExt}`;
  await writeFile(path.join(dir, filename), imageBuf);

  // 缩略图：列表/画廊用（原图 ~2.7MB 经隧道要 8s，缩略图 <100KB 秒开；点击再看原图）
  let thumbRel = "";
  try {
    const sharp = (await import("sharp")).default;
    const thumb = await sharp(imageBuf)
      .resize({ width: 480, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    await writeFile(path.join(dir, `t_${stamp}.jpg`), thumb);
    thumbRel = `/generated/t_${stamp}.jpg`;
  } catch (e) {
    console.log("[thumb] 缩略图失败(回退用原图):", e instanceof Error ? e.message : e);
  }

  // 同步登记到服务端台账（我的作品 = 全部生成，含公网观众）
  try {
    const ledgerPath = path.join(process.cwd(), "data", "gallery.json");
    let ledger: unknown[] = [];
    try {
      ledger = JSON.parse(await readFile(ledgerPath, "utf-8"));
    } catch {}
    if (!Array.isArray(ledger)) ledger = [];
    ledger.push({
      image: `/generated/${filename}`,
      thumb: thumbRel || undefined,
      styleId: p.styleId,
      styleName: p.styleName,
      ts: Date.now(),
    });
    await writeFile(ledgerPath, JSON.stringify(ledger), "utf-8");
  } catch (e) {
    console.log("[gallery] 台账写入失败:", e instanceof Error ? e.message : e);
  }

  jobs.set(jobId, {
    status: "done",
    imageUrl: `/generated/${filename}`,
    thumbUrl: thumbRel || `/generated/${filename}`,
    ts: Date.now(),
  });
}
