import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // next start 启动时快照 public/，运行期新生成的图片 404 → 走 API 实时读盘
        source: "/generated/:file",
        destination: "/api/generated/:file",
      },
    ];
  },
};

export default nextConfig;
