"use strict";

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Pino Logger Config */
const loggerConfig = () => {
  const NODE_ENV = process.env.NODE_ENV;
  switch (NODE_ENV) {
    case "development":
      return {
        transport: {
          target: "pino-pretty",
          options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      };
    case "test":
      return false;
    default:
      return true;
  }
};

const envConfig = {
  dotenv: {
    path: resolve(__dirname, "../.env"),
  },
  schema: {
    type: "object",
    required: ["SERVER_PORT", "DB_MYSQL_URL"],
    properties: {
      SERVER_PORT: { type: "number", default: 3001 },
      NODE_ENV: { type: "string", default: "development" },
      DB_MYSQL_URL: {
        type: "string",
        default: "mysql://root@localhost/uhero_db_dev",
      },
    },
  },
};

export { loggerConfig, envConfig };
