"use client";

import { useState } from "react";

interface SplitFrameProps {
  /** 生成图 URL（上半=原片、下半=风格化的合成图） */
  src: string;
  alt?: string;
  className?: string;
}

/**
 * 生成图互动相框：把合成图按中线切成上下两半——
 * 上半（原片）与下半（风格化）作为两个独立图层叠放互动。
 *
 * 收起态：下半缩为小条收在底部（露出风格化一瞥），上半占满。
 * 点击：两半平滑交换面积（上半缩小、下半长大），或展开整图。
 */
export function SplitFrame({ src, alt = "", className = "" }: SplitFrameProps) {
  // 0 = 收起（上原片占大头）；1 = 展开（下风格化占大头）；中间值由过渡驱动
  const [open, setOpen] = useState(false);
  const EASE = "cubic-bezier(0.22,1,0.36,1)";

  // 上半区域高度：收起 78%，展开 40%（面积互动的核心变量）
  const topH = open ? 40 : 78;

  return (
    <div
      className={`group relative w-full cursor-pointer overflow-hidden bg-card ${className}`}
      onClick={() => setOpen((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((v) => !v)}
      aria-label={open ? "展开风格化部分" : "展开完整海报"}
    >
      {/* 上半图层：合成图的上 50%（原片），顶部对齐 */}
      <div
        className="absolute left-0 right-0 top-0 overflow-hidden"
        style={{
          height: `${topH}%`,
          transition: `height 700ms ${EASE}`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className="absolute left-0 w-full"
          style={{ height: "200%", top: 0 }} /* 图高 2 倍框高 → 只露上半 */
        />
      </div>

      {/* 下半图层：合成图的下 50%（风格化），底部对齐 */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden"
        style={{
          height: `${100 - topH}%`,
          transition: `height 700ms ${EASE}`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className="absolute left-0 w-full"
          style={{ height: "200%", bottom: 0 }} /* 图高 2 倍框高 → 只露下半 */
        />
      </div>

      {/* 中缝装饰线：两半的分界，hover 时微微发亮提示可点 */}
      <div
        className="pointer-events-none absolute left-0 right-0 h-px bg-foreground/15 transition-all duration-500 group-hover:bg-primary/60"
        style={{ top: `${topH}%` }}
      />

      {/* 角标 */}
      <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] text-white/90 transition-opacity duration-300"
        style={{ opacity: open ? 0.35 : 1 }}>
        原片
      </span>
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-sm bg-primary/85 px-1.5 py-0.5 text-[10px] text-primary-foreground transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0.35 }}>
        风格化 · {open ? "点击看原片" : "点击展开"}
      </span>
    </div>
  );
}
