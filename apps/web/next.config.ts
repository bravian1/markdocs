import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript sources — transpile them.
  transpilePackages: [
    "@markdocs/editor",
    "@markdocs/markdown-core",
    "@markdocs/shared",
  ],
};

export default nextConfig;
