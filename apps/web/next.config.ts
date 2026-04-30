import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pnpm stores Next under the monorepo node_modules path, so Turbopack needs the workspace root.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
