"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { StyleCard } from "@/components/style-card";
import type { BoardType, StyleItem } from "@/lib/styles";
import { boards } from "@/lib/styles";

export function StylesBrowser({
  styles,
  tags,
  initialQuery = "",
  initialTag = "全部",
  initialBoard = "transform",
}: {
  styles: StyleItem[];
  tags: string[];
  initialQuery?: string;
  initialTag?: string;
  initialBoard?: BoardType;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery.trim());
  const [active, setActive] = useState(initialTag);
  const [board, setBoard] = useState<BoardType>(initialBoard);

  // 状态同步到 URL（不产生历史记录），刷新/分享/返回都保持一致
  const syncUrl = useCallback(
    (b: BoardType, t: string) => {
      const params = new URLSearchParams();
      params.set("board", b);
      if (t !== "全部") params.set("tag", t);
      router.replace(`/styles?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const switchBoard = useCallback(
    (b: BoardType) => {
      setBoard(b);
      setActive("全部");
      syncUrl(b, "全部");
    },
    [syncUrl],
  );

  const switchTag = useCallback(
    (t: string) => {
      setActive(t);
      syncUrl(board, t);
    },
    [board, syncUrl],
  );

  const visible = styles.filter((s) => s.type === board);
  const boardTags = [...new Set(visible.flatMap((s) => s.tags))];

  const byQuery = (s: StyleItem) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.num.includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  };
  const filtered = visible.filter(
    (s) => (active === "全部" || s.tags.includes(active)) && byQuery(s),
  );

  return (
    <div>
      {/* 板块 Tab */}
      <div className="mb-6 flex flex-wrap gap-2">
        {boards.map((b) => {
          const count = styles.filter((s) => s.type === b.key).length;
          return (
            <button
              key={b.key}
              onClick={() => switchBoard(b.key)}
              aria-pressed={board === b.key}
              className={`flex items-baseline gap-2 rounded-sm border px-5 py-2.5 text-left transition-colors ${
                board === b.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              <span className="font-serif text-base font-bold">{b.label}</span>
              <span className="text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        {boards.find((b) => b.key === board)?.desc}
      </p>

      {query && (
        <div className="mb-6 flex items-center gap-3 rounded-sm border border-border bg-card px-4 py-2.5 text-sm">
          <span>
            搜索「<span className="font-bold">{query}</span>」的结果：{filtered.length} 个风格
          </span>
          <button
            onClick={() => setQuery("")}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            清除搜索
          </button>
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        {["全部", ...boardTags].map((t) => (
          <button
            key={t}
            onClick={() => switchTag(t)}
            aria-pressed={active === t}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              active === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {t}
            {t !== "全部" && (
              <span className="ml-1 text-[10px] opacity-60">
                {visible.filter((s) => s.tags.includes(t)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 pb-16 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((s) => (
          <StyleCard key={s.id} style={s} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="pb-16 text-center text-sm text-muted-foreground">
          没有符合条件的风格，换个关键词试试
        </p>
      )}
    </div>
  );
}
