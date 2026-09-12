/**
 * 生成图片服务：绕过 next start 的 public 启动快照——
 * 生产模式下运行期新增到 public/ 的文件会 404，改为实时从磁盘读取。
 * GET /generated/<file>（浏览器 <img> 直接引用此路径由 next.config 重写到这里）
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  // 只放行安全的文件名（字母数字/下划线/点），防路径穿越
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file)) {
    return NextResponse.json({ error: "非法文件名" }, { status: 400 });
  }
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) {
    return NextResponse.json({ error: "不支持的类型" }, { status: 400 });
  }
  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "generated", file),
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }
}
