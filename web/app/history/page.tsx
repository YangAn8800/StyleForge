import { HistoryClient } from "@/components/history-client";

// 不预渲染（原因见 app/m/page.tsx：预渲染 HTML 会被缓存一年，改版后仍跑旧代码）
export const dynamic = "force-dynamic";

export const metadata = { title: "生成历史 · StyleForge" };

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-serif text-sm font-bold tracking-index text-primary">
        HISTORY · 生成历史
      </p>
      <h1 className="mt-2 font-serif text-3xl font-black">我的海报</h1>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">
        每次真实生成都会自动保存 · 按时间倒序
      </p>
      <HistoryClient />
    </div>
  );
}
