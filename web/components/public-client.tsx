/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateImage, type AspectRatio } from "@/lib/generate";
import { fetchJsonRetry } from "@/lib/net";
import { TunnelImg } from "@/components/tunnel-img";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import type { StyleItem } from "@/lib/styles";

interface GalleryItem {
  image: string;
  thumb?: string;
  styleId: string;
  styleName: string;
  ts: number;
}

/**
 * 公开版 H5（扫码进入）：
 * 风格库 / 生成海报 / 我的作品（服务端共享画廊）三个 Tab，
 * 风格仅限 data/public-styles.json 列出的（本机收藏导出）。
 * 无任何通往站内其他页面的链接。
 */
export function PublicClient({ publicStyles }: { publicStyles: StyleItem[] }) {
  const [tab, setTab] = useState<"styles" | "create" | "history">("styles");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // 压缩后的 dataURL 必须放 state：它是在 img.onload 里异步算出来的，
  // 写 ref 不触发重渲染，底部按钮的 disabled 就永远停在"还没照片"的状态
  // （表现为必须先切一次 Tab 才能点）。
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");
  const [result, setResult] = useState<{
    imageUrl: string;
    real: boolean;
    notice?: string;
    retryable?: boolean;
    styleName: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  // 等待轮播：生成中循环播放所选风格的样例图
  const [carouselIdx, setCarouselIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    const data = await fetchJsonRetry<{ items?: GalleryItem[] }>("/api/gallery");
    setGallery(Array.isArray(data?.items) ? data.items : []);
    setGalleryLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "history") loadGallery();
  }, [tab, loadGallery]);

  const pickedStyle = publicStyles.find((s) => s.id === picked);

  const samples = pickedStyle?.images ?? [];
  useEffect(() => {
    setCarouselIdx(0);
  }, [picked]);
  useEffect(() => {
    if (status !== "generating" || samples.length <= 1) return;
    const t = setInterval(() => {
      setCarouselIdx((i) => (i + 1) % samples.length);
    }, 2600);
    return () => clearInterval(t);
  }, [status, samples.length]);


  const handleFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setErr("");
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoData(null); // 换图期间先禁用生成，避免用上一张的旧数据提交
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

  const pickAndGo = (id: string) => {
    setPicked(id);
    setStatus("idle");
    setResult(null);
    setTab("create");
  };

  const generate = async () => {
    if (!photoData || !picked) return;
    setErr("");
    setStatus("generating");
    try {
      const { imageUrl, real, notice, retryable } = await generateImage(
        { styleId: picked },
        photoData,
        "3:4" as AspectRatio,
      );
      const styleName = pickedStyle?.name ?? "";
      setResult({ imageUrl, real, notice, retryable, styleName });
      setStatus("done");
      // 台账已在服务端登记，这里只需刷新画廊缓存（下次进「我的作品」Tab 会重新拉取）
    } catch (e) {
      setStatus("idle");
      setErr(e instanceof Error ? e.message : "生成失败，请重试");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background px-4 pb-28 pt-3">
      {/* 顶栏：仅两个 Tab */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 pb-2 pt-1 backdrop-blur">
        <p className="font-serif text-base font-black tracking-wide">
          StyleForge<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">AI 海报工坊</span>
        </p>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["styles", "风格库"],
              ["create", "生成海报"],
              ["history", "我的作品"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 font-serif text-sm font-bold transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {label}
              {key === "styles" && (
                <span className="ml-1 text-[10px] opacity-70">{publicStyles.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: 生成器 */}
      {tab === "create" && (
        <div>
          {!picked && (
            <p className="mb-3 rounded-lg bg-secondary px-3 py-2 text-xs leading-5 text-muted-foreground">
              先去「风格库」挑一个喜欢的风格，回来上传照片就能生成 ∨
              <button onClick={() => setTab("styles")} className="ml-1 text-primary underline underline-offset-2">
                现在去挑
              </button>
            </p>
          )}

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
                  点击后可选拍照或从相册选择 · 建议 3:4 竖版 · 生成约 1–3 分钟
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

          {picked && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
              <img
                src={pickedStyle?.cover}
                alt={pickedStyle?.name}
                className="h-14 w-11 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-sm font-bold">
                  {pickedStyle?.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {pickedStyle?.tags.slice(0, 3).join(" · ") || "精选风格"}
                </p>
              </div>
              <button
                onClick={() => setTab("styles")}
                className="shrink-0 rounded-sm border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                换风格
              </button>
            </div>
          )}

          {status === "generating" && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="font-serif font-bold text-primary">正在生成你的海报…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                约 1–3 分钟 ·「{pickedStyle?.name}」正在重绘你的照片
              </p>
              {/* 等待轮播：所选风格的样例效果（仅供预览） */}
              {samples.length > 0 && (
                <div className="relative mt-3">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary">
                    {samples.map((src, i) => (
                      <div
                        key={src}
                        className="absolute inset-0 transition-opacity duration-700"
                        style={{ opacity: i === carouselIdx ? 1 : 0 }}
                      >
                        {/* 隧道会掐断约 1/4 的图片请求：失败自动重试，避免样例只剩 alt 文本 */}
                        <TunnelImg
                          src={src}
                          alt={`${pickedStyle?.name} 样例`}
                          className="h-full w-full"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    ↑ 该风格的样例效果 · 仅供预览 · 你的专属海报马上就好
                  </p>
                  {samples.length > 1 && (
                    <div className="mt-1.5 flex justify-center gap-1.5">
                      {samples.map((src, i) => (
                        <span
                          key={src}
                          className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            i === carouselIdx ? "bg-primary" : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-serif text-base font-bold">
                  {result.real ? "生成完成 · 你的专属海报" : "生成遇到问题 · 展示的是样例图"}
                </h2>
              </div>
              {/* 生成图本身是「上原片 / 下风格化」合成图，按原始比例整图直出，不再拆分变形；
                  生成图为 1024×1536（2:3），容器按 2:3 定高恰好无裁切 */}
              <TunnelImg
                src={result.imageUrl}
                alt={result.styleName}
                className="aspect-[2/3] w-full rounded-lg border border-border"
              />
              <div className="mt-3 flex gap-2">
                <a
                  href={result.imageUrl}
                  download
                  className="flex-1 rounded-lg bg-primary py-3 text-center font-serif text-sm font-bold text-primary-foreground"
                >
                  保存图片
                </a>
                <button
                  onClick={() => setLightbox(result.imageUrl)}
                  className="flex-1 rounded-lg border border-border bg-card py-3 font-serif text-sm font-bold text-muted-foreground"
                >
                  查看大图
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
                点「保存图片」直接下载；若浏览器无反应，点「查看大图」后长按图片保存到相册
              </p>
              {result.real === false && (
                <p className="mt-2 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-center text-[11px] leading-4 text-amber-700">
                  {result.notice ?? "生成服务暂时不可用，上面是该风格的样例图。请稍后重试，重试不消耗你的操作。"}
                </p>
              )}
              {result.retryable && (
                <button
                  onClick={generate}
                  className="mt-2 w-full rounded-lg border border-primary/50 bg-card py-3 font-serif text-sm font-bold text-primary"
                >
                  重试生成
                </button>
              )}
            </div>
          )}

          {err && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
              {err}
            </p>
          )}
        </div>
      )}

      {/* Tab: 风格库（仅公开列表） */}
      {tab === "styles" && (
        <div className="grid grid-cols-2 gap-3">
          {publicStyles.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <button
                onClick={() => pickAndGo(s.id)}
                className="relative block w-full active:opacity-90"
              >
                <img
                  src={s.cover}
                  alt={s.name}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 flex items-baseline justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-white">
                  <span className="truncate font-serif text-sm font-bold">{s.name}</span>
                  {picked === s.id && <span className="text-[10px]">已选 ✓</span>}
                </span>
              </button>
              {/* 展开提示词：不跳站内详情页，就地展开 */}
              <details className="px-2.5 py-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  查看提示词
                </summary>
                <p className="mt-1.5 max-h-40 overflow-y-auto text-[11px] leading-5 text-muted-foreground">
                  {s.prompt}
                </p>
                <div className="mt-1.5">
                  <CopyPromptButton text={s.prompt} />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Tab: 我的作品（服务端共享画廊——所有人共用一个库） */}
      {tab === "history" && (
        <div>
          {galleryLoading && (
            <p className="py-10 text-center text-xs text-muted-foreground">加载中…</p>
          )}
          {!galleryLoading && gallery.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="font-serif text-base font-bold">还没有作品</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                大家生成的海报都会汇集在这里，来生成第一张吧。
              </p>
              <button
                onClick={() => setTab("styles")}
                className="mt-4 rounded-lg bg-primary px-5 py-2.5 font-serif text-sm font-bold text-primary-foreground"
              >
                去挑个风格 →
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {gallery.map((it) => (
              <div
                key={it.image}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <button
                  onClick={() => setLightbox(it.image)}
                  className="relative block w-full"
                >
                  <img
                    src={it.thumb ?? it.image}
                    alt={it.styleName}
                    loading="lazy"
                    className="aspect-[3/4] w-full bg-secondary object-cover transition-opacity duration-500"
                  />
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {it.styleName}
                  </span>
                  <a
                    href={it.image}
                    download
                    className="shrink-0 text-[11px] text-primary"
                  >
                    保存
                  </a>
                </div>
              </div>
            ))}
          </div>
          {gallery.length > 0 && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              共 {gallery.length} 张 · 与所有使用者共享的作品墙
            </p>
          )}
        </div>
      )}

      {/* 灯箱：长按可保存 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="生成海报"
            className="max-h-[85vh] max-w-full rounded-sm object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/70">
            长按图片可保存到相册 · 点击空白处关闭
          </p>
        </div>
      )}

      {/* 底部固定生成按钮（仅生成 Tab） */}
      {tab === "create" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              type="button"
              disabled={!photoData || status === "generating"}
              onClick={picked ? generate : () => setTab("styles")}
              className="w-full rounded-lg bg-primary py-3.5 font-serif text-base font-bold text-primary-foreground shadow-lg transition-opacity disabled:opacity-40"
            >
              {status === "generating"
                ? "生成中…"
                : !photoData
                  ? photoUrl
                    ? "照片处理中…"
                    : "请先上传照片"
                  : picked
                    ? `用「${pickedStyle?.name}」生成海报`
                    : "照片已就绪 · 去挑一个风格 →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
