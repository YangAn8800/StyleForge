/**
 * 共享作品库 API：
 * GET /api/gallery          → 全部生成作品（公网可读——观众与电脑共享同一画廊）
 * DELETE /api/gallery?img=… → 删除指定作品（仅本机 localhost，电脑端管理用；
 *                              同时删磁盘文件与台账条目）
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export interface GalleryItem {
  image: string; // /generated/xxx.png 原图
  thumb?: string; // /generated/t_xxx.jpg 缩略图（旧数据可能没有）
  styleId: string;
  styleName: string;
  ts: number;
}

async function loadLedger(): Promise<GalleryItem[]> {
  try {
    const arr = JSON.parse(
      await readFile(path.join(process.cwd(), "data", "gallery.json"), "utf-8"),
    );
    return Array.isArray(arr) ? (arr as GalleryItem[]) : [];
  } catch {
    return [];
  }
}

async function saveLedger(items: GalleryItem[]) {
  await writeFile(
    path.join(process.cwd(), "data", "gallery.json"),
    JSON.stringify(items),
    "utf-8",
  );
}

function isLocalRequest(req: NextRequest) {
  const origin = (req.headers.get("origin") ?? "").toLowerCase();
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return (
    origin.includes("//localhost") || origin.includes("//127.0.0.1") ||
    host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
  );
}

export async function GET() {
  // 最近在前；thumb 缺失时回退原图
  const items = (await loadLedger())
    .sort((a, b) => b.ts - a.ts)
    .map((it) => ({ ...it, thumb: it.thumb ?? it.image }));
  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: "仅本机可删除作品" }, { status: 403 });
  }
  const img = new URL(req.url).searchParams.get("img") ?? "";
  // 只允许删 /generated/ 下的单文件名，防路径穿越
  const m = img.match(/^\/generated\/([a-z0-9]+\.(?:png|jpg|jpeg|webp))$/i);
  if (!m) {
    return NextResponse.json({ error: "非法图片路径" }, { status: 400 });
  }
  const items = await loadLedger();
  const rest = items.filter((it) => it.image !== img);
  if (rest.length === items.length) {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  }
  await saveLedger(rest);
  // 删原图与缩略图（文件不存在则忽略）
  const deleted = items.find((it) => it.image === img);
  const files = [m[1]];
  if (deleted?.thumb) {
    const tm = deleted.thumb.match(/^\/generated\/(.+)$/);
    if (tm) files.push(tm[1]);
  }
  for (const f of files) {
    try {
      await unlink(path.join(process.cwd(), "public", "generated", f));
    } catch {}
  }
  return NextResponse.json({ ok: true, remaining: rest.length });
}
