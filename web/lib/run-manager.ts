/**
 * 生图运行管理器（顶层单例）
 *
 * 问题：CreateClient 的生图循环在组件内 → 用户切到别的页面或刷新页面，
 *       组件卸载，循环中断，回到 /create 又得从头开始。
 *
 * 解决：把生图运行状态提升到模块顶层（脱离组件生命周期），同步写入
 *       localStorage。组件只是订阅 / 启动。
 *
 *   - 模块首次加载时如果 localStorage 里有"正在生成"的运行 → 自动续跑
 *   - 用户切走再回来 → worker 一直在跑，回来时看到的就是最新进度
 *   - 刷新页面 → worker 继续从断点（最近一个未完成的任务）跑下去
 *   - 中途服务重启导致任务在服务端丢失 → 自动重新提交该任务
 */

import { submitJob, pollJob, ASPECT_SIZES, type AspectRatio } from "@/lib/generate";

export interface RunTaskInit {
  /** 唯一 ID（同一次 run 内不能重复；建议用 styleId 或 "custom"） */
  key: string;
  styleId?: string;
  /** UI 显示名 */
  name: string;
  /** 自定义提示词（与 styleId 二选一） */
  prompt?: string;
  /** 失败时用这张图占位（通常是该风格的封面），保持 UI 一致 */
  coverUrl?: string;
}

interface RunTask extends RunTaskInit {
  jobId?: string;
  status: "pending" | "submitted" | "done" | "error";
  imageUrl?: string;
  thumbUrl?: string;
  real?: boolean;
  notice?: string;
  retryable?: boolean;
  errorMsg?: string;
}

export interface RunResult {
  key: string;
  styleId: string;
  styleName: string;
  imageUrl: string;
  thumbUrl?: string;
  real: boolean;
  notice?: string;
  retryable?: boolean;
}

export interface RunState {
  photoData: string;
  aspect: AspectRatio;
  tasks: RunTask[];
  cursor: number; // 当前正在处理第几个任务（< tasks.length 表示还在跑）
  status: "generating" | "done";
  progressText: string;
  startedAt: number;
  results: RunResult[];
}

const KEY = "styleforge-run-v1";

let run: RunState | null = null;
let workerPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

/* ---------- 订阅 ---------- */

export function getRun(): RunState | null {
  return run;
}
export function subscribeRun(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(): void {
  for (const fn of listeners) fn();
}

/* ---------- 持久化 ---------- */

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify(run));
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage 写满（多半是 photoData 太大）—— 静默失败；
    // 内存里的 run 仍能继续跑，只是不再抗刷新。
  }
}

/* ---------- 启动 ---------- */

export function startRun(opts: {
  photoData: string;
  aspect: AspectRatio;
  tasks: RunTaskInit[];
}): void {
  run = {
    photoData: opts.photoData,
    aspect: opts.aspect,
    tasks: opts.tasks.map((t) => ({ ...t, status: "pending" })),
    cursor: 0,
    status: "generating",
    progressText: "准备中…",
    startedAt: Date.now(),
    results: [],
  };
  persist();
  notify();
  // 老 worker（如果有的话）让它自然完成；新 run 用新的 promise。
  workerPromise = runWorker();
}

export function clearRun(): void {
  run = null;
  workerPromise = null;
  persist();
  notify();
}

/* ---------- Worker ---------- */

async function runWorker(): Promise<void> {
  if (!run) return;
  const size = ASPECT_SIZES[run.aspect];

  // 最多跑 N 轮（每一轮 cursor 前进一步；遇 "unknown" 重提交也按一轮算）
  // 防意外死循环
  const maxIterations = run.tasks.length * 4 + 8;
  let iter = 0;

  while (run && run.cursor < run.tasks.length && iter < maxIterations) {
    iter++;
    const t = run.tasks[run.cursor];

    if (t.status === "done") {
      run.cursor++;
      continue;
    }
    if (t.status === "error") {
      run.cursor++;
      continue;
    }

    run.progressText = `正在用「${t.name}」重绘你的照片…（${run.cursor + 1}/${run.tasks.length}）`;
    notify();

    try {
      // 1) 提交（如果没有 jobId，或上一轮被 "unknown" 清掉）
      if (!t.jobId) {
        const { jobId } = await submitJob({
          styleId: t.styleId,
          prompt: t.prompt,
          photo: run.photoData,
          size,
        });
        t.jobId = jobId;
        t.status = "submitted";
        persist();
        notify();
      }

      // 2) 轮询
      const r = await pollJob(t.jobId);
      t.imageUrl = r.imageUrl;
      t.thumbUrl = r.thumbUrl;
      t.status = "done";
      t.real = true;
      run.results.push({
        key: t.key,
        styleId: t.styleId ?? "custom",
        styleName: t.name,
        imageUrl: r.imageUrl,
        thumbUrl: r.thumbUrl,
        real: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      if ((msg === "unknown" || /unknown/i.test(msg)) && t.jobId) {
        // 服务端任务表里没了（多半是服务端重启过），清掉 jobId 重提
        t.jobId = undefined;
        t.status = "pending";
        persist();
        notify();
        continue; // 重新走一遍"提交 → 轮询"
      }

      t.status = "error";
      t.errorMsg = msg;
      run.results.push({
        key: t.key,
        styleId: t.styleId ?? "custom",
        styleName: t.name,
        imageUrl: t.coverUrl ?? "",
        real: false,
        notice: `生成失败：${msg}`,
        retryable: true,
      });
    }

    run.cursor++;
    persist();
    notify();
  }

  if (run) {
    run.status = "done";
    run.progressText = "";
    persist();
    notify();
  }
}

/* ---------- 自动续跑 ---------- */
// 模块顶层（页面加载时）只执行一次：从 localStorage 读回状态；
// 如果上次是在跑 → 继续跑（断点续传）。
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RunState;
      run = parsed;
      if (parsed.status === "generating") {
        workerPromise = runWorker();
      }
    }
  } catch {
    /* localStorage 读失败：当作新会话 */
  }
}