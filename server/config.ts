"use strict";

import { FastifyLoggerOptions } from "fastify";
import { PinoLoggerOptions } from "fastify/types/logger";

const PORT = 3001;

const getDatabaseURI = () => {
  const NODE_ENV = process.env.NODE_ENV;
  return NODE_ENV === "test"
    ? process.env.TEST_URL || "uhero_db_test"
    : process.env.DATABASE_URL || "mysql://root@localhost/uhero_db_dev";
};

/** Pino Logger Config */
const loggerConfig = () => {
  const NODE_ENV = process.env.NODE_ENV;
  console.log(NODE_ENV);
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
  dotenv: true,
  schema: {
    type: "object",
    required: ["PORT"],
    properties: {
      PORT: { type: "string", default: "3000" },
      NODE_ENV: { type: "string", default: "development" },
    },
  },
};

export { loggerConfig, PORT, getDatabaseURI, envConfig };
