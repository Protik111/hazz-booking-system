import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained `.next/standalone` build for minimal Docker images.
  output: "standalone",
};

export default nextConfig;
