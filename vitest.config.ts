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
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./src/test/setup-node.ts"],
          include: [
            "src/lib/**/*.test.ts",
            "src/mode-editor/**/*.test.ts",
          ],
          exclude: [
            "src/lib/download-port.test.ts",
            "src/lib/local-drafts.test.ts",
            "src/lib/param-io.test.ts",
            "src/lib/personal-base-specifications.test.ts",
            "src/lib/stl-export.test.ts",
            "src/lib/worker/worker-service.test.ts",
            "src/**/*.integration.test.ts",
            "src/**/*.performance.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: [
            "src/app/**/*.test.tsx",
            "src/components/**/*.test.ts",
            "src/components/**/*.test.tsx",
            "src/hooks/**/*.test.ts",
            "src/hooks/**/*.test.tsx",
            "src/viewports/**/*.test.ts",
            "src/viewports/**/*.test.tsx",
            "src/workspaces/**/*.test.ts",
            "src/workspaces/**/*.test.tsx",
            "src/lib/download-port.test.ts",
            "src/lib/local-drafts.test.ts",
            "src/lib/param-io.test.ts",
            "src/lib/personal-base-specifications.test.ts",
            "src/lib/stl-export.test.ts",
            "src/lib/worker/worker-service.test.ts",
          ],
          exclude: [
            "src/**/*.integration.test.ts",
            "src/**/*.integration.test.tsx",
          ],
        },
      },
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
        "src/**/*.performance.test.ts",
      ],
    },
  },
});
