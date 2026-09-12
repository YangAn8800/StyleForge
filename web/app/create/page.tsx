import { CreateClient } from "@/components/create-client";

export const metadata = { title: "生成器 · StyleForge" };

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string; prompt?: string }>;
}) {
  const { style, prompt } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-serif text-sm font-bold tracking-index text-primary">
        CREATE · 开始创作
      </p>
      <h1 className="mb-8 mt-2 font-serif text-3xl font-black">生成你的海报</h1>
      <CreateClient initialStyleId={style} initialPrompt={prompt} />
    </div>
  );
}
