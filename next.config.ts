import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IS_VERCEL: process.env.VERCEL === '1' ? '1' : '',
  },
};

export default nextConfig;
