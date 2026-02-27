import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
  serverExternalPackages: ["pino"],
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
