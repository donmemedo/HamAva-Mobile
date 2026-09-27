import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://localhost:8037";

const config: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default config;
