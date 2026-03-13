import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/download/mac",
        destination: "https://github.com/Bbasche/verbum/releases/latest/download/Verbum.dmg",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
