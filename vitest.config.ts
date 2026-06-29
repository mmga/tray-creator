import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 确保 React 加载 development build（含 act 等 test-utils），
// 否则外部 shell 的 NODE_ENV=production 会让 react.act 为 undefined，
// 触发 "@testing-library/react" 的 "React.act is not a function" 错误。
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
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
    ],
    exclude: [
      "src/**/*.integration.test.ts",
      "src/**/*.integration.test.tsx",
      ".next/**",
      "node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
        "src/**/*.integration.test.ts",
        "src/**/*.integration.test.tsx",
      ],
    },
  },
});
