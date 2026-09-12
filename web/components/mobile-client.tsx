/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { generateImage, type AspectRatio } from "@/lib/generate";
import { useFavorites } from "@/lib/use-favorites";
import { useHistory } from "@/lib/use-history";
import { styles, type StyleItem } from "@/lib/styles";

/**
 * H5 极简生成页（手机专用）：
 * ① 拍照/选图 ② 从收藏的风格里挑一个 ③ 生成 → 生成图直接展示。
 * 只展示收藏（桌面上收藏过的风格），列表干净、流程单一。
 */
export function MobileClient() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");
  const [result, setResult] = useState<{
    imageUrl: string;
    real: boolean;
    notice?: string;
    styleName: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // 压缩后的 dataURL 放 state（不是 ref）：它在 img.onload 里异步算出，
  // 写 ref 不触发重渲染，底部按钮的 disabled 会一直停在"还没照片"。
  const [photoData, setPhotoData] = useState<string | null>(null);
  const { favs, ready } = useFavorites();
  const history = useHistory();

  const favStyles = useMemo<StyleItem[]>(
    () => styles.filter((s) => favs.has(s.id) && s.type === "transform"),
    [favs],
  );
  const pickedStyle = styles.find((s) => s.id === picked);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setErr("");
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoData(null); // 换图期间先禁用，避免用上一张的旧数据提交
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhotoData(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = url;
    setStatus("idle");
    setResult(null);
  }, []);

  const generate = async () => {
    if (!photoData || !picked) return;
    const photo = photoData;
    setErr("");
    setStatus("generating");
    try {
      const { imageUrl, real, notice } = await generateImage(
        { styleId: picked },
        photo,
        "3:4" as AspectRatio,
      );
      const styleName = pickedStyle?.name ?? "";
      setResult({ imageUrl, real, notice, styleName });
      setStatus("done");
      if (real && imageUrl.startsWith("/generated/")) {
        history.add({
          image: imageUrl,
          styleId: picked,
          styleName,
          photo,
          ts: Date.now(),
          real,
        });
      }
    } catch (e) {
      setStatus("idle");
      setErr(e instanceof Error ? e.message : "生成失败，请重试");
    }
  };

  const step = !photoUrl ? 1 : !picked ? 2 : 3;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-24 pt-4">
      {/* 顶部进度指示 */}
      <div className="mb-5 flex items-center justify-between">
        <p className="font-serif text-lg font-black tracking-wide">
          StyleForge<span className="ml-1.5 text-xs font-normal text-muted-foreground">手机版</span>
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {["上传", "选风格", "生成"].map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-1 ${
                step > i
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card"
              }`}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      {/* ① 上传区（拍照/相册） */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-card active:scale-[0.99]"
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="已选照片" className="h-full w-full object-contain" />
            <span className="absolute bottom-2 right-2 rounded-sm bg-black/60 px-2 py-1 text-xs text-white">
              点按更换
            </span>
          </>
        ) : (
          <div className="text-center">
            <p className="font-serif text-lg font-bold">选择照片</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              点击后可选拍照或从相册选择 · 建议 3:4 竖版
            </p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </button>

      {/* ② 收藏风格选择 */}
      <div className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="font-serif text-base font-bold">挑一个收藏的风格</h2>
          <span className="text-[11px] text-muted-foreground">
            {ready ? `收藏 ${favStyles.length} 个` : "…"}
          </span>
        </div>

        {ready && favStyles.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-4 text-center text-sm leading-6 text-muted-foreground">
            还没有收藏任何风格。
            <br />
            在电脑上打开 风格库 → 点风格卡片右上角 ★ 收藏，
            手机上就能在这里选用。
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {favStyles.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setPicked(s.id);
                setStatus("idle");
                setResult(null);
              }}
              className={`relative overflow-hidden rounded-md border-2 transition-transform active:scale-[0.97] ${
                picked === s.id ? "border-primary shadow-md" : "border-transparent"
              }`}
            >
              <img
                src={s.cover}
                alt={s.name}
                className="aspect-[3/4] w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                {s.name}
              </span>
              {picked === s.id && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 结果 / 报错 */}
      {status === "generating" && (
        <div className="mt-5 rounded-lg border border-border bg-card p-4">
          <p className="font-serif font-bold text-primary">正在生成…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            约 1–3 分钟 ·「{pickedStyle?.name}」正在重绘你的照片
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-serif text-base font-bold">生成完成</h2>
            <a
              href={result.imageUrl}
              download
              className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs active:bg-secondary"
            >
              保存到手机
            </a>
          </div>
          <img
            src={result.imageUrl}
            alt={result.styleName}
            className="w-full rounded-lg border border-border"
          />
          {result.notice && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{result.notice}</p>
          )}
        </div>
      )}

      {err && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
          {err}
        </p>
      )}

      {/* ③ 底部固定生成按钮 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            disabled={!photoData || !picked || status === "generating"}
            onClick={generate}
            className="w-full rounded-lg bg-primary py-3.5 font-serif text-base font-bold text-primary-foreground shadow-lg transition-opacity disabled:opacity-40"
          >
            {status === "generating"
              ? "生成中…"
              : picked
                ? `用「${pickedStyle?.name}」生成海报`
                : "先上传照片并选择风格"}
          </button>
        </div>
      </div>
    </div>
  );
}
