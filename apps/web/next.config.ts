import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is also a root `package-lock.json` for `apps/gateway`; pin Turbopack to this app.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
