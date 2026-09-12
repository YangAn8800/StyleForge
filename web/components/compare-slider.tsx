"use client";

import { useRef, useState } from "react";

interface CompareSliderProps {
  before: React.ReactNode;
  after: React.ReactNode;
  initial?: number;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

/**
 * 轻量 before/after 对照滑块：拖动分界线，左侧露出 before，右侧露出 after。
 * before/after 接收任意节点（图片、裁剪容器等），由调用方决定如何呈现。
 */
export function CompareSlider({
  before,
  after,
  initial = 50,
  beforeLabel = "原片",
  afterLabel = "风格化",
  className = "",
}: CompareSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(initial);
  const dragging = useRef(false);

  const update = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  };

  return (
    <div
      ref={ref}
      className={`relative touch-none select-none overflow-hidden ${className}`}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) update(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {after}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {before}
      </div>

      {beforeLabel && (
        <span className="absolute left-3 top-3 rounded-sm bg-black/55 px-2 py-0.5 text-xs text-white">
          {beforeLabel}
        </span>
      )}
      {afterLabel && (
        <span className="absolute right-3 top-3 rounded-sm bg-primary/90 px-2 py-0.5 text-xs text-primary-foreground">
          {afterLabel}
        </span>
      )}

      <div
        className="absolute inset-y-0 z-10 w-px bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.4)]"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/45 text-xs text-white backdrop-blur">
          ↔
        </span>
      </div>
    </div>
  );
}
