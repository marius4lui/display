import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16.2 does not yet recognize TypeScript 7 during its internal setup.
  // CI still runs `tsc --noEmit` before every Next build.
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
