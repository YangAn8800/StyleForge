"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StyleCard } from "@/components/style-card";
import type { StyleItem } from "@/lib/styles";

/**
 * 精选风格 + 换一批：从全量风格中随机抽一批展示，点击「换一批」重新抽取。
 * 抽取时做轻量去重（避免与当前批重复），保证每批都新鲜。
 */
export function FeaturedShuffle({ styles }: { styles: StyleItem[] }) {
  const [batch, setBatch] = useState<StyleItem[]>(() => sample(styles, [], 8));
  const [spinning, setSpinning] = useState(false);

  const shuffle = useCallback(() => {
    setSpinning(true);
    setBatch(sample(styles, batch, 8));
    setTimeout(() => setSpinning(false), 500);
  }, [styles, batch]);

  return (
    <section className="pb-16">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-2xl font-black">精选风格</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            每一种风格背后，都是一段精心打磨的提示词
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={shuffle}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <span
              className={`inline-block transition-transform duration-500 ${spinning ? "rotate-180" : ""}`}
            >
              ⟳
            </span>
            换一批
          </button>
          <Link
            href="/styles"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            查看全部 →
          </Link>
        </div>
      </div>
      <div key={batch.map((s) => s.id).join(",")} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 [animation:fadeIn_0.4s_ease]">
        {batch.map((s) => (
          <StyleCard key={s.id} style={s} />
        ))}
      </div>
    </section>
  );
}

function sample(pool: StyleItem[], exclude: StyleItem[], n: number): StyleItem[] {
  const excl = new Set(exclude.map((s) => s.id));
  const shuffled = pool
    .filter((s) => !excl.has(s.id))
    .map((s) => ({ s, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, n)
    .map((x) => x.s);
  // 池子不够时（不可能发生，但兜底）放宽排除
  return shuffled.length === n ? shuffled : sample(pool, [], n);
}
