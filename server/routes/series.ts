import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { NotFoundError } from "../errors";
import Series from "../models/series";

interface SeriesParams {
  id: string;
  offset: number;
  limit: number;
}

const listOpts = {
  schema: {
    params: {
      type: "object",
      properties: {
        offset: { type: "number", default: 0 },
        limit: { type: "number", default: 40 },
      },
    },
  },
};

const singleOpts = {
  schema: {
    params: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
};

/**
 * Series
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get<{ Params: SeriesParams }>(
    "/series",
    listOpts,
    async (request, response) => {
      const { offset, limit } = request.params;
      const series = await Series.findMany(app.mysql, { offset, limit });
      return { status: 200, series };
    }
  );

  app.get<{ Params: SeriesParams }>(
    "/series/:id",
    singleOpts,
    async (request, response) => {
      const { id } = request.params;

      try {
        const series = await Series.find(app.mysql, id);
        if (!series) {
          response.code(404);
          return { error: "Series not found" };
        }
        return { series: 200, message: id, body: series };
      } catch (err) {
        request.log.error("Database error:", err);
        response.code(500);
        return { error: "Database error" };
      }
    }
  );
}

export default routes;
