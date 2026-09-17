import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
  serverExternalPackages: ["pino"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
  allowedDevOrigins: ['128.171.199.228'],
};

export default nextConfig;
