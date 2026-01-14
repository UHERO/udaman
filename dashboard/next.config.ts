import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  turbo: { root: "../" },
  env: {
    DB_HOST: process.env.DATABASE_URL,
  },
};

export default nextConfig;
