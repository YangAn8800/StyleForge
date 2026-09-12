import type { Metadata } from "next";
import { PublicClient } from "@/components/public-client";
import publicStyleIds from "@/data/public-styles.json";
import { styles, type StyleItem } from "@/lib/styles";

// 不预渲染：预渲染 HTML 带 s-maxage=31536000，改完代码后浏览器可能一直用旧 HTML
// （指向已删除的旧 JS chunk），于是"服务端修好了但用户那边还是坏的"。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StyleForge · AI 海报工坊",
  description: "挑一个风格，上传照片，生成属于你的艺术海报。",
};

export default function MobilePage() {
  // 公开风格 = data/public-styles.json 列表（本机收藏导出），与浏览器 localStorage 无关
  const idSet = new Set(publicStyleIds as string[]);
  const publicStyles = styles.filter((s) => idSet.has(s.id));

  return (
    /* data-h5 页面隐藏全站页眉页脚（见 globals.css），公开页自成一体、无站内出口 */
    <div className="min-h-dvh bg-background" data-h5>
      <PublicClient publicStyles={publicStyles} />
    </div>
  );
}
