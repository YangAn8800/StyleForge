import { ComposeClient } from "@/components/compose-client";

export const metadata = { title: "定制提示词 · StyleForge" };

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-serif text-sm font-bold tracking-index text-primary">
        COMPOSE · 拼装你的提示词
      </p>
      <h1 className="mb-2 mt-2 font-serif text-3xl font-black">定制提示词</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        像拼贴一样选择风格、色彩与文字方案——所有片段都提炼自库内经过验证的提示词，拼出来的结果可直接使用
      </p>
      <ComposeClient />
    </div>
  );
}
