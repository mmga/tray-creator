import type { NextConfig } from "next";

const isAdmin = process.env.NEXT_PUBLIC_ADMIN_MODE === "true";

const nextConfig: NextConfig = {
  // 生产构建默认静态导出；管理员模式保留服务端能力（API Route / SSR）
  output:
    process.env.NODE_ENV === "production" && !isAdmin ? "export" : undefined,
  images: {
    unoptimized: true,
  },
  // Ensure we don't conflict with the main Next.js build cache when running Admin mode concurrently
  distDir: isAdmin ? ".next-admin" : ".next",
};

export default nextConfig;
