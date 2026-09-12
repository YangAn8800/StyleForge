"use client";

import { useCallback, useEffect, useState } from "react";
import { StyleCard } from "@/components/style-card";
import type { StyleItem } from "@/lib/styles";

/**
 * 相关风格随机推荐：每次挂载随机抽取，点「换一批」重新抽。
 */
export function RelatedShuffle({ pool, initial }: { pool: StyleItem[]; initial: StyleItem[] }) {
  // 挂载即随机（initial 仅作 SSR 首屏内容，客户端立刻洗牌避免水合闪烁采用延迟洗牌）
  const [batch, setBatch] = useState<StyleItem[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const current = batch ?? initial;

  const draw = useCallback(
    (exclude?: Set<string>) => {
      return pool
        .filter((s) => !exclude?.has(s.id))
        .map((s) => ({ s, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, 4)
        .map((x) => x.s);
    },
    [pool],
  );

  useEffect(() => {
    // 挂载后立即随机一次（水合完成后）
    setBatch(draw());
  }, [draw]);

  const shuffle = useCallback(() => {
    setSpinning(true);
    setBatch(draw(new Set(current.map((s) => s.id))));
    setTimeout(() => setSpinning(false), 500);
  }, [draw, current]);

  return (
    <section className="mt-14 pb-16">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold">换个口味看看</h2>
        <button
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <span className={`inline-block transition-transform duration-500 ${spinning ? "rotate-180" : ""}`}>
            ⟳
          </span>
          换一批
        </button>
      </div>
      <div key={current.map((s) => s.id).join(",")} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 [animation:fadeIn_0.4s_ease]">
        {current.map((s) => (
          <StyleCard key={s.id} style={s} />
        ))}
      </div>
    </section>
  );
}
