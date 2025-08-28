"use strict";

import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import seriesRoutes from "./routes/series";
import rootRoute from "./routes/root";
import categoriesRoutes from "./routes/categories";
import { loggerConfig, envConfig, getDatabaseURI } from "./config";
import mysql from "@fastify/mysql";

const app = Fastify({
  logger: loggerConfig(),
});

app.register(fastifyEnv, envConfig);

app.register(mysql, {
  connectionString: getDatabaseURI(),
  promise: true,
});

app.register(rootRoute);
app.register(seriesRoutes);
app.register(categoriesRoutes);

export { app };
