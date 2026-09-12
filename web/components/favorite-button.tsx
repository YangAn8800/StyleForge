"use client";

import { useFavorites } from "@/lib/use-favorites";

/** 详情页收藏按钮：星形大按钮，收藏后填充 */
export function FavoriteButton({ styleId, styleName }: { styleId: string; styleName: string }) {
  const { favs, toggle } = useFavorites();
  const active = favs.has(styleId);

  return (
    <button
      onClick={() => toggle(styleId)}
      aria-pressed={active}
      title={active ? "取消收藏" : "收藏到我的列表"}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm transition-all duration-300 ${
        active
          ? "border-amber-500/70 bg-amber-50 text-amber-700"
          : "border-border bg-card text-muted-foreground hover:border-amber-500/50 hover:text-amber-600"
      }`}
    >
      <span className={`transition-transform duration-300 ${active ? "scale-110" : ""}`}>
        {active ? "★" : "☆"}
      </span>
      {active ? "已收藏" : "收藏"}
    </button>
  );
}

/** 卡片角标收藏：小星标，点击不冒泡（不触发卡片跳转） */
export function CardFavorite({ styleId }: { styleId: string }) {
  const { favs, toggle } = useFavorites();
  const active = favs.has(styleId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(styleId);
      }}
      aria-label={active ? "取消收藏" : "收藏"}
      className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-base backdrop-blur transition-all duration-300 ${
        active
          ? "bg-amber-400/90 text-white shadow"
          : "bg-black/35 text-white/80 opacity-0 hover:bg-black/55 group-hover:opacity-100"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
