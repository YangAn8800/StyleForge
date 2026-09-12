/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { PromptViewer } from "@/components/prompt-viewer";
import { GalleryGrid } from "@/components/gallery-grid";
import { FavoriteButton } from "@/components/favorite-button";
import { StyleCard } from "@/components/style-card";
import { RelatedShuffle } from "@/components/related-shuffle";
import { getStyle, styles, boardLabel } from "@/lib/styles";

export function generateStaticParams() {
  return styles.map((s) => ({ id: s.id }));
}

export default async function StyleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const style = getStyle(id);
  if (!style) notFound();

  // 相关风格：同板块候选池传给客户端组件，挂载时随机抽取（SSG 页面也能每次不同）
  const pool = styles.filter((s) => s.id !== style.id && s.type === style.type);
  const related = pool.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* 标题区 */}
      <Link
        href={`/styles?board=${style.type}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← 返回{boardLabel(style.type)}库
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-serif font-bold tracking-index text-primary">
            {boardLabel(style.type)} · NO.{style.num}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">
            {style.name}
          </h1>
          <div className="mt-3 flex gap-2">
            {style.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {style.type === "transform" ? (
            <Link
              href={`/create?style=${style.id}`}
              className={buttonVariants({ size: "lg", className: "font-medium" })}
            >
              用这个风格试试 →
            </Link>
          ) : (
            <CopyPromptButton text={style.prompt} />
          )}
          <FavoriteButton styleId={style.id} styleName={style.name} />
        </div>
      </div>

      {/* 样例画廊 */}
      <section className="mt-10">
        <h2 className="mb-4 font-serif text-xl font-bold">
          样例画廊
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {style.images.length} 张
          </span>
        </h2>
        <GalleryGrid images={style.images} caption={style.name} />
      </section>

      {/* 提示词 */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold">这段提示词怎么写</h2>
          <CopyPromptButton text={style.prompt} />
        </div>
        <div className="max-h-96 overflow-y-auto rounded-sm border border-border bg-card p-5">
          <PromptViewer text={style.prompt} groupId={style.id} />
        </div>
      </section>

      {/* 相关风格（客户端随机 + 换一批） */}
      <RelatedShuffle pool={pool} initial={related} />
    </div>
  );
}
