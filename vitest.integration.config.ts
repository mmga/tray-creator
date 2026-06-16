import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 确保 React 加载 development build（含 act），见 vitest.config.ts 注释
(process.env as Record<string, string>).NODE_ENV = "test";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    env: {
      NODE_ENV: "test",
    },
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.integration.test.ts", "src/**/*.integration.test.tsx"],
    passWithNoTests: true,
  },
});
