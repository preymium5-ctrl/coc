import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next's generated route types separate from Vinext's .next/types.
  distDir: '.next-vercel',
  // The dashboard is shared with the local Vinext build as a static HTML module.
  webpack(config) {
    config.module.rules.push({test:/\.html$/,type:'asset/source'});
    return config;
  },
};

export default nextConfig;
