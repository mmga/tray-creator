import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
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
