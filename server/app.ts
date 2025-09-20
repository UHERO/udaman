"use strict";

import fastifyEnv from "@fastify/env";
import mysql from "@fastify/mysql";
import Fastify from "fastify";

import { envConfig } from "./config";
import categoriesRoutes from "./routes/categories";
import rootRoute from "./routes/root";
import seriesRoutes from "./routes/series";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    },
  },
});

await app.register(fastifyEnv, envConfig);

await app.register(mysql, {
  connectionString: app.config.DB_MYSQL_URL,
  promise: true,
  multipleStatements: true,
});

app.register(rootRoute);
app.register(seriesRoutes);
app.register(categoriesRoutes);

export { app };
