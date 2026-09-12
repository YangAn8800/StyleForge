/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { FeaturedHeroCarousel } from "@/components/featured-hero-carousel";
import { StyleSearch } from "@/components/style-search";
import { FeaturedShuffle } from "@/components/featured-shuffle";
import { styles, stylesByBoard, boards, type StyleItem } from "@/lib/styles";

// 不预渲染（原因见 app/m/page.tsx：预渲染 HTML 会被缓存一年，改版后仍跑旧代码）
export const dynamic = "force-dynamic";

const steps = [
  { no: "01", title: "挑选风格", desc: "从风格库里选一个打动你的样式" },
  { no: "02", title: "上传照片", desc: "一张清晰、主体完整的照片效果最好" },
  { no: "03", title: "生成海报", desc: "稍等片刻，拿到属于你的艺术海报" },
];

export default function Home() {
  // 首页 Hero 轮播：从不同风格类型里挑几张有代表性的（点击进入风格详情）
  const heroIds = ["transform-93", "transform-01", "transform-02", "transform-08", "transform-09"];
  const heroStyles = heroIds
    .map((id) => styles.find((s) => s.id === id))
    .filter((s): s is StyleItem => Boolean(s));
  const marqueeCovers = styles.map((s) => ({
    src: s.cover,
    name: s.name,
    id: s.id,
    num: s.num,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2">
        <div>
          <p className="mb-4 font-serif text-sm font-bold tracking-index text-primary">
            NO.001 — NO.100 · 一天解锁一个AI提示词
          </p>
          <h1 className="font-serif text-4xl font-black leading-snug sm:text-5xl">
            把你的照片，
            <br />
            变成一张
            <span className="text-primary">艺术海报</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
            上半是你的原片，下半是 AI 重构的艺术表达——水墨、彩铅、几何平涂、
            炭笔素描。挑一个风格，上传一张照片，剩下的事交给提示词。
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/create"
              className={buttonVariants({ size: "lg", className: "font-medium" })}
            >
              立即创作
            </Link>
            <Link
              href="/styles"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "font-medium",
              })}
            >
              浏览风格库
            </Link>
          </div>
          <p className="mt-6 text-xs tracking-index text-muted-foreground">
            {styles.length} 种风格 · 免费体验 · 无需注册
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <FeaturedHeroCarousel styles={heroStyles} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            上：原片 · 下：风格化表达 — 自动轮播 · 悬浮暂停 · 点击进入风格
          </p>
        </div>
      </section>

      {/* 搜索区（搜索引擎式大搜索框） */}
      <section className="mx-auto -mt-2 max-w-2xl pb-12 pt-2 text-center">
        <StyleSearch size="hero" />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">热门：</span>
          {["手绘", "水墨", "涂鸦", "童趣", "油画", "几何"].map((t) => (
            <Link
              key={t}
              href={`/styles?tag=${encodeURIComponent(t)}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* 走马灯 */}
      <section className="marquee-hover-pause -mx-4 overflow-hidden border-y border-border py-4 sm:-mx-6">
        <div className="animate-marquee flex w-max gap-4">
          {[...marqueeCovers, ...marqueeCovers].map((c, i) => (
            <Link
              key={i}
              href={`/styles/${c.id}`}
              className="relative block w-28 shrink-0 overflow-hidden rounded-sm border border-border sm:w-32"
              title={c.name}
            >
              <img
                src={c.src}
                alt={c.name}
                className="aspect-[3/4] w-full object-cover"
              />
              <span className="absolute bottom-1 left-1.5 font-serif text-[10px] font-bold tracking-index text-white drop-shadow">
                NO.{c.num}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 三步流程 */}
      <section className="grid gap-6 py-12 sm:grid-cols-3 sm:py-16">
        {steps.map((s) => (
          <div key={s.no} className="border-t-2 border-foreground/80 pt-4">
            <p className="font-serif text-3xl font-black tracking-index text-primary/80">
              {s.no}
            </p>
            <h3 className="mt-2 font-serif text-lg font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </section>

      {/* 双板块入口 */}
      <section className="grid gap-4 pb-12 sm:grid-cols-2">
        {boards.map((b) => (
          <Link
            key={b.key}
            href={`/styles?board=${b.key}`}
            className="group rounded-sm border border-border bg-card p-6 transition-shadow hover:shadow-lg"
          >
            <p className="font-serif text-xs font-bold tracking-index text-primary">
              {b.en}
            </p>
            <h3 className="mt-2 font-serif text-xl font-black">
              {b.label}
              <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                {stylesByBoard(b.key).length} 种
              </span>
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {b.desc}
            </p>
            <p className="mt-4 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
              进入浏览 →
            </p>
          </Link>
        ))}
      </section>

      {/* 精选风格（可换一批） */}
      <FeaturedShuffle styles={styles} />
    </div>
  );
}
