import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "作品广场 · StyleForge" };

export default function CommunityPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="font-serif text-sm font-bold tracking-index text-primary">
        COMMUNITY · 作品广场
      </p>
      <h1 className="mt-4 font-serif text-5xl font-black sm:text-6xl">
        即将上线
      </h1>
      <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
        这里将展示大家用各种风格创作的海报：点赞、做同款、参加每周主题挑战。
        我们正在加紧装修，敬请期待。
      </p>
      <div className="mt-10 flex w-full max-w-sm items-center gap-2">
        <input
          type="email"
          placeholder="留下邮箱，上线时通知你"
          className="h-10 flex-1 rounded-sm border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button className="font-medium">订阅</Button>
      </div>
      <Link
        href="/create"
        className="mt-12 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        先去创作一张 →
      </Link>
    </div>
  );
}
