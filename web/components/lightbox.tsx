/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  caption?: string;
}

/**
 * 全屏画廊式查看器：当前图居中，左右相邻缩略图立在两侧，点击切换。
 * 切换为平滑滑动过渡：旧图沿方向滑出、新图从对侧滑入（双图同时渲染）。
 */
export function Lightbox({ images, index, onClose, onNavigate, caption }: LightboxProps) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── 滑动切换状态机 ──
  // anim = {from, to, dir} 进行中的切换；to 期间的 index 已是新图
  const [anim, setAnim] = useState<{ from: number; dir: 1 | -1 } | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current);
    };
  }, []);

  // 包一层导航：发起滑动动画，结束后清理
  const navigate = useCallback(
    (target: number) => {
      if (target === index || anim) return; // 动画中或目标相同则忽略
      const dir: 1 | -1 = target > index || (index === images.length - 1 && target === 0) ? 1 : -1;
      setAnim({ from: index, dir });
      onNavigate(target);
      if (animTimer.current) clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setAnim(null), 520);
    },
    [index, anim, images.length, onNavigate],
  );

  const close = useCallback(() => {
    setClosing(true);
    const t = setTimeout(onClose, 240);
    return () => clearTimeout(t);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") navigate((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") navigate((index + 1) % images.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close, navigate, index, images.length]);

  const visible = entered && !closing;
  const n = images.length;
  const prevIdx = (index - 1 + n) % n;
  const nextIdx = (index + 1) % n;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      {/* 关闭按钮 */}
      <button
        onClick={close}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-all duration-300 hover:rotate-90 hover:bg-white/25"
        aria-label="关闭"
      >
        ×
      </button>

      {/* 三图并排：左缩略 | 主图轨道 | 右缩略 */}
      <div className="relative flex h-full w-full items-center justify-center">
        {n > 1 && (
          <ThumbButton
            src={images[prevIdx]}
            side="left"
            visible={visible}
            onPick={() => navigate(prevIdx)}
            ariaLabel={`切换到第 ${prevIdx + 1} 张`}
          />
        )}

        {/* 主图滑动轨道：切换时双图同屏，旧图滑出 / 新图滑入 */}
        <div
          className="relative z-10 h-[84vh] w-[52vw] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`flex h-full w-full items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              visible ? "scale-100" : "scale-[0.94]"
            }`}
          >
            {anim ? (
              <div className="relative h-full w-full">
                {/* 出场图（旧 index） */}
                <SlideImg
                  src={images[anim.from]}
                  alt={`${caption ?? "样例"} ${anim.from + 1}`}
                  state="out"
                  dir={anim.dir}
                />
                {/* 入场图（新 index = 当前 index） */}
                <SlideImg
                  src={images[index]}
                  alt={`${caption ?? "样例"} ${index + 1}`}
                  state="in"
                  dir={anim.dir}
                />
              </div>
            ) : (
              <img
                src={images[index]}
                alt={`${caption ?? "样例"} ${index + 1}`}
                className="max-h-full max-w-full rounded-sm object-contain shadow-2xl"
              />
            )}
          </div>
        </div>

        {n > 1 && (
          <ThumbButton
            src={images[nextIdx]}
            side="right"
            visible={visible}
            onPick={() => navigate(nextIdx)}
            ariaLabel={`切换到第 ${nextIdx + 1} 张`}
          />
        )}
      </div>

      {/* 底部：标题 + 页码 */}
      <div
        className={`absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-5 py-2 text-sm text-white transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {caption && <span className="font-serif">{caption}</span>}
        {n > 1 && (
          <span className="tracking-index">
            {index + 1} / {n}
          </span>
        )}
      </div>
    </div>
  );
}

/** 滑动轨道中的单张图：in = 从对侧滑入到中心，out = 从中心滑向方向侧 */
function SlideImg({
  src, alt, state, dir,
}: {
  src: string;
  alt: string;
  state: "in" | "out";
  dir: 1 | -1;
}) {
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoved(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // dir=1（向右切换）：入场图起点在右侧 +100%，出场图终点在左侧 -100%；dir=-1 反之
  const startX = state === "in" ? (dir === 1 ? 100 : -100) : 0;
  const endX = state === "in" ? 0 : (dir === 1 ? -100 : 100);

  return (
    <img
      src={src}
      alt={alt}
      className={`absolute inset-0 m-auto max-h-full max-w-full rounded-sm object-contain shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        state === "in" ? "z-10" : "z-0"
      }`}
      style={{ transform: `translateX(${moved ? endX : startX}%)` }}
    />
  );
}

/** 两侧缩略图：压暗立式，hover 提亮放大，点击切换 */
function ThumbButton({
  src, side, visible, onPick, ariaLabel,
}: {
  src: string;
  side: "left" | "right";
  visible: boolean;
  onPick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onPick(); }}
      aria-label={ariaLabel}
      className={`group absolute top-1/2 z-0 -translate-y-1/2 overflow-hidden rounded-sm border border-white/15 bg-black/40 shadow-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        side === "left" ? "left-[4vw]" : "right-[4vw]"
      } ${
        visible
          ? "h-[46vh] w-[15vw] opacity-60 group-hover:opacity-100"
          : "h-[38vh] w-[12vw] opacity-0"
      }`}
      style={{ maxWidth: 240, maxHeight: 520 }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-black/70 px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {side === "left" ? "‹ 上一张" : "下一张 ›"}
      </span>
    </button>
  );
}
