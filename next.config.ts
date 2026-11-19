import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // remove the Next.js dev "N" badge from the bottom-left corner permanently
  devIndicators: false,
};

export default nextConfig;
