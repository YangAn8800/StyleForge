"use client";

import { useEffect, useState } from "react";

/* eslint-disable @next/next/no-img-element */

interface TunnelImgProps {
  src: string;
  alt?: string;
  /**
   * 尺寸要由调用方给足：组件内部 img 是 h-full w-full object-cover，
   * 所以 className 里必须带 aspect-* 或 absolute inset-0 之类的定高方式。
   */
  className?: string;
  /** 加载失败最多重试次数（隧道实测约 1/4 请求被掐断，失败不重试就永远是碎图） */
  maxRetries?: number;
}

/**
 * 弱网/隧道环境下的自愈图片：onError 后指数退避自动重新加载。
 * 失败的请求不会被浏览器缓存，换个 cache-busting 参数重发即可；
 * 加载/重试期间显示米色脉动占位，而不是碎图图标 + alt 文本。
 */
export function TunnelImg({
  src,
  alt = "",
  className = "",
  maxRetries = 6,
}: TunnelImgProps) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // 换图时重置重试状态
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [src]);

  const finalSrc =
    attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

  return (
    <span
      role="img"
      aria-label={alt}
      className={`relative block overflow-hidden bg-secondary ${className}`}
    >
      {!loaded && (
        <span className="pointer-events-none absolute inset-0 animate-pulse bg-secondary" />
      )}
      <img
        src={finalSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (attempt < maxRetries) {
            setTimeout(() => setAttempt((a) => a + 1), 400 * (attempt + 1));
          }
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
