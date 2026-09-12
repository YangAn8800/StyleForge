"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { type StyleItem } from "@/lib/styles";

/* eslint-disable @next/next/no-img-element */

interface FeaturedHeroCarouselProps {
  styles: StyleItem[];
  /** 自动切换间隔（毫秒）。鼠标悬浮时暂停，离开后恢复 */
  intervalMs?: number;
  className?: string;
}

/**
 * 首页 Hero 轮播：封面图原样直接展示（上原片 / 下风格化的对照图本身），
 * 不做任何裁切、拆分或拉伸。每 5s 自动切下一张，鼠标悬浮暂停，
 * 底部圆点可手动跳；点击整图进入该风格详情页。
 */
export function FeaturedHeroCarousel({
  styles,
  intervalMs = 5000,
  className = "",
}: FeaturedHeroCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = styles.length;

  const advance = useCallback(() => {
    setIdx((i) => (i + 1) % total);
  }, [total]);

  // 自动轮播（悬浮暂停）
  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setTimeout(advance, intervalMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idx, paused, total, intervalMs, advance]);

  if (total === 0) return null;
  const current = styles[idx];

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm border border-border shadow-xl">
        {styles.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
            aria-hidden={i !== idx}
          >
            <Link href={`/styles/${s.id}`} className="block h-full w-full" title={s.name}>
              <img
                src={s.cover}
                alt={s.name}
                className="h-full w-full object-cover"
              />
            </Link>
          </div>
        ))}
      </div>

      {/* 当前张的小标题 + 跳转 */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={`/styles/${current.id}`}
          className="font-serif text-sm font-bold tracking-index text-foreground hover:text-primary"
        >
          {current.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            NO.{current.num}
          </span>
        </Link>
        <span className="text-[10px] text-muted-foreground">
          {paused ? "已暂停" : `${idx + 1} / ${total}`}
        </span>
      </div>

      {/* 圆点导航 */}
      {total > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {styles.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              aria-label={`切换到 ${s.name}`}
              aria-current={i === idx ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx
                  ? "w-5 bg-primary"
                  : "w-1.5 bg-foreground/25 hover:bg-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
