import { StylesBrowser } from "@/components/styles-browser";
import { styles } from "@/lib/styles";
import type { BoardType } from "@/lib/styles";

export const metadata = { title: "风格库 · StyleForge" };

export default async function StylesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; board?: string }>;
}) {
  const { q, tag, board } = await searchParams;
  const initialBoard: BoardType =
    board === "generate" ? "generate" : "transform";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-serif text-sm font-bold tracking-index text-primary">
        STYLE INDEX · 风格索引
      </p>
      <h1 className="mt-2 font-serif text-3xl font-black">风格库</h1>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">
        共 {styles.length} 种风格，每种都配有真实样例与完整提示词
      </p>
      <StylesBrowser
        styles={styles}
        tags={[...new Set(styles.flatMap((s) => s.tags))]}
        initialQuery={q ?? ""}
        initialTag={tag ?? "全部"}
        initialBoard={initialBoard}
      />
    </div>
  );
}
