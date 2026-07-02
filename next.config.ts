import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
  serverExternalPackages: ["pino"],
  serverActions: {
    bodySizeLimit: "50mb",
  },
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
