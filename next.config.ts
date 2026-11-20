import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // 内核加载器的 Node.js 路径仅在 Node.js 中运行，浏览器无需此模块。
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:module$/, "module"));
      config.resolve.fallback = { ...config.resolve.fallback, module: false };
    }
    return config;
  },
};

export default nextConfig;
