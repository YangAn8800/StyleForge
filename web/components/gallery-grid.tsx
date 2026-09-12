/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Lightbox } from "@/components/lightbox";

interface GalleryGridProps {
  images: string[];
  caption: string;
}

/** 样例画廊网格：点击任意图片打开全屏灯箱 */
export function GalleryGrid({ images, caption }: GalleryGridProps) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setActive(i)}
            className="group relative overflow-hidden rounded-sm border border-border"
            aria-label={`放大查看 ${caption} 样例 ${i + 1}`}
          >
            <img
              src={src}
              alt={`${caption} 样例 ${i + 1}`}
              className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute bottom-2 right-2 rounded-sm bg-black/55 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              点击放大
            </span>
          </button>
        ))}
      </div>
      {active !== null && (
        <Lightbox
          images={images}
          index={active}
          caption={caption}
          onClose={() => setActive(null)}
          onNavigate={setActive}
        />
      )}
    </>
  );
}
