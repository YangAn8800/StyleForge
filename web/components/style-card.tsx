/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CardFavorite } from "@/components/favorite-button";
import type { StyleItem } from "@/lib/styles";

export function StyleCard({ style }: { style: StyleItem }) {
  return (
    <Link
      href={`/styles/${style.id}`}
      className="group relative block overflow-hidden rounded-sm border border-border bg-card transition-shadow hover:shadow-lg"
    >
      <CardFavorite styleId={style.id} />
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={style.cover}
          alt={style.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {style.type === "generate" && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            海报生成
          </span>
        )}
        <span className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
          <span className="font-serif text-sm font-bold tracking-index">
            NO.{style.num}
          </span>
          <span className="text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            试试这个风格 →
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <h3 className="truncate font-serif text-base font-bold">{style.name}</h3>
        <div className="flex shrink-0 gap-1">
          {style.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
