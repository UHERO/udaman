import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

export const config = {
  DB_MYSQL_URL: process.env.DB_MYSQL_URL!,
  NODE_ENV: process.env.NODE_ENV!,
};
