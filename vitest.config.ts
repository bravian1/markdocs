import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@markdocs/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@markdocs/markdown-core": path.resolve(__dirname, "packages/markdown-core/src/index.ts"),
      "@markdocs/editor": path.resolve(__dirname, "packages/editor/src/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
  },
});
