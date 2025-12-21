"use strict";

import fastifyEnv from "@fastify/env";
import mysql from "@fastify/mysql";
import Fastify from "fastify";

import { envConfig } from "./config";
import categoriesRoutes from "./routes/categories";
import dataLoadersRoutes from "./routes/data-loaders";
import geographiesRoutes from "./routes/geographies";
import rootRoute from "./routes/root";
import seriesRoutes from "./routes/series";

const app = Fastify({
  // Treat /path and /path/ the same so navigation to /path/ doesn't throw a 404
  ignoreTrailingSlash: true,
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
app.register(dataLoadersRoutes);
app.register(categoriesRoutes);
app.register(geographiesRoutes);

export { app };
