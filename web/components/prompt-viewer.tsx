import { CATEGORY_META, getGroupTags, type TagCategory } from "@/lib/tags";

interface PromptViewerProps {
  text: string;
  /** 风格组 id：提供时读取 tags.json 的高亮区间 */
  groupId?: string;
  /** 展示图例 */
  legend?: boolean;
}

/**
 * 彩色提示词渲染器：按 tags.json 的 spans 区间给原文上色。
 * avoid 类灰色+删除线，其余按类别色；无区间处保持正文样式。
 */
export function PromptViewer({ text, groupId, legend = true }: PromptViewerProps) {
  const { spans } = groupId ? getGroupTags(groupId) : { spans: [] };

  const parts: Array<{ seg: string; cat?: TagCategory }> = [];
  let cursor = 0;
  for (const [start, end, cat] of spans as unknown as Array<[number, number, TagCategory, string]>) {
    if (start > cursor) parts.push({ seg: text.slice(cursor, start) });
    parts.push({ seg: text.slice(start, end), cat });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ seg: text.slice(cursor) });

  const usedCats = [...new Set(spans.map((s) => (s as unknown as unknown[])[2] as TagCategory))]
    .filter((c) => c !== "base");

  return (
    <div>
      {legend && usedCats.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
          {usedCats.map((c) => (
            <span key={c} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CATEGORY_META[c].color }}
              />
              {CATEGORY_META[c].label}
            </span>
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap font-serif text-sm leading-7">
        {parts.map((p, i) =>
          p.cat ? (
            <span
              key={i}
              title={CATEGORY_META[p.cat].label}
              style={{
                color: CATEGORY_META[p.cat].color,
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
  );
}
