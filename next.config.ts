import type { NextConfig } from "next";

const isAdmin = process.env.NEXT_PUBLIC_ADMIN_MODE === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ensure we don't conflict with the main Next.js build cache when running Admin mode concurrently
  distDir: isAdmin ? '.next-admin' : '.next',
};

export default nextConfig;
