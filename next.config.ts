import type { NextConfig } from "next";

const isAdmin = process.env.NEXT_PUBLIC_ADMIN_MODE === 'true';

const nextConfig: NextConfig = {
  // 仅生产构建时启用静态导出；开发模式下关闭以支持本地 API Mock
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  // Ensure we don't conflict with the main Next.js build cache when running Admin mode concurrently
  distDir: isAdmin ? '.next-admin' : '.next',
};

export default nextConfig;
