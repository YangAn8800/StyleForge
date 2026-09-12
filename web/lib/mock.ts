import { getStyle } from "@/lib/styles";

/**
 * Mock 生成服务：中转站 image2 接入后，只需替换这个文件的实现，
 * 页面层（create-client）完全不用动。
 * 返回该风格样例图里的一张，模拟真实的异步生成耗时。
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockGenerate(styleId: string): Promise<string> {
  await sleep(1400 + Math.random() * 1200);
  const style = getStyle(styleId);
  const imgs = style?.images ?? [];
  if (imgs.length === 0) throw new Error("该风格没有样例图");
  return imgs[Math.floor(Math.random() * imgs.length)];
}
