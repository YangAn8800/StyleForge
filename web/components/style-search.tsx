/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { styles } from "@/lib/styles";

/**
 * 风格搜索框：按名称 / 标签 / 编号实时联想，回车进入风格库搜索结果页。
 * size="hero"   首页大搜索框
 * size="compact" 顶栏小搜索框
 */
export function StyleSearch({ size = "hero" }: { size?: "hero" | "compact" }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return styles
      .filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.num.includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const hero = size === "hero";

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-full border border-border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring ${
          hero ? "h-13 px-5 shadow-lg" : "h-9 px-3"
        }`}
      >
        <Search className={hero ? "h-5 w-5 text-muted-foreground" : "h-4 w-4 shrink-0 text-muted-foreground"} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) go(`/styles?q=${encodeURIComponent(q.trim())}`);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={
            hero ? "搜索风格、标签或编号，例如：水墨 / NO.093 / 手绘" : "搜索风格…"
          }
          className={`w-full bg-transparent outline-none placeholder:text-muted-foreground ${
            hero ? "text-base" : "text-sm"
          }`}
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="清空"
          >
            ×
          </button>
        )}
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-sm border border-border bg-card shadow-xl">
          {matches.length > 0 ? (
            <ul>
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => go(`/styles/${s.id}`)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <img
                      src={s.cover}
                      alt={s.name}
                      className="h-12 w-9 rounded-sm border border-border object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-sm font-bold">
                        {s.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        NO.{s.num} · {s.tags.join(" / ")}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">查看 →</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              没有找到「{q.trim()}」，
              <button
                onClick={() => go("/styles")}
                className="text-primary underline underline-offset-2"
              >
                去风格库逛逛
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
