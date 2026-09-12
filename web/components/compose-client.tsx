"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { compose, type Selection } from "@/lib/compose";
import { SLOTS } from "@/lib/compose-slots";
import { CATEGORY_META } from "@/lib/tags";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { buttonVariants } from "@/components/ui/button";

const DEFAULT_SEL: Selection = {
  style: "geometric",
  texture: ["paper-grain"],
  color: "from-photo",
  text: "editorial",
  mood: ["premium"],
  avoid: ["no-plastic3d", "no-neon", "no-cartoon", "no-crowd", "no-watermark", "no-face-swap"],
};

export function ComposeClient() {
  const [sel, setSel] = useState<Selection>(DEFAULT_SEL);

  const { prompt, spans, notices } = useMemo(() => compose(sel), [sel]);

  const toggle = (slotId: string, optionId: string, multiple?: boolean) => {
    setSel((prev) => {
      const multiSlots: Array<"mood" | "avoid" | "texture"> = ["mood", "avoid", "texture"];
      if (multiSlots.includes(slotId as "mood")) {
        const key = slotId as "mood" | "avoid" | "texture";
        const cur = prev[key] ?? [];
        return {
          ...prev,
          [key]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId],
        } as Selection;
      }
      // 单选槽：再次点击取消选择
      const cur = prev[slotId as "style" | "color" | "text"];
      return { ...prev, [slotId]: cur === optionId ? undefined : optionId } as Selection;
    });
  };

  // 把 spans 渲染成彩色段落（与详情页 PromptViewer 同构的轻量版）
  const colored = useMemo(() => {
    const parts: Array<{ seg: string; cat?: string }> = [];
    let cursor = 0;
    for (const s of spans) {
      if (s.start > cursor) parts.push({ seg: prompt.slice(cursor, s.start) });
      parts.push({ seg: prompt.slice(s.start, s.end), cat: s.cat });
      cursor = s.end;
    }
    if (cursor < prompt.length) parts.push({ seg: prompt.slice(cursor) });
    return parts;
  }, [prompt, spans]);

  return (
    <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* 左：槽位选择 */}
      <div className="space-y-7">
        {SLOTS.map((slot) => (
          <section key={slot.id}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-base font-bold">{slot.label}</h2>
              <span className="text-xs text-muted-foreground">{slot.desc}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {slot.options.map((opt) => {
                const active = slot.multiple
                  ? (sel[slot.id as "mood"] ?? []).includes(opt.id)
                  : sel[slot.id as "style"] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggle(slot.id, opt.id, slot.multiple)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: active ? "currentColor" : CATEGORY_META[opt.cat].color }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* 右：实时结果 */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold">拼装结果</h2>
          <div className="flex gap-2">
            <CopyPromptButton text={prompt} />
            <Link
              href={`/create?prompt=${encodeURIComponent(prompt)}`}
              className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              拿去生成 →
            </Link>
          </div>
        </div>

        {notices.map((n, i) => (
          <p key={i} className="mt-2 rounded-sm border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ {n}
          </p>
        ))}

        <div className="mt-3 max-h-[560px] overflow-y-auto rounded-sm border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
            {spans.map((s, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: CATEGORY_META[s.cat].color }} />
                {CATEGORY_META[s.cat].label}
              </span>
            ))}
          </div>
          <p className="whitespace-pre-wrap font-serif text-sm leading-7">
            {colored.map((p, i) =>
              p.cat ? (
                <span
                  key={i}
                  style={{
                    color: CATEGORY_META[p.cat as keyof typeof CATEGORY_META].color,
                    textDecorationLine: p.cat === "avoid" ? "line-through" : "none",
                    textDecorationStyle: p.cat === "avoid" ? "dotted" : undefined,
                    fontWeight: p.cat === "style" ? 600 : 400,
                  }}
                >
                  {p.seg}
                </span>
              ) : (
                <span key={i}>{p.seg}</span>
              ),
            )}
          </p>
        </div>
        <p className="mt-2 text-right text-xs text-muted-foreground">{prompt.length} 字</p>
      </div>
    </div>
  );
}
