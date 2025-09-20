import { series } from "@prisma/client";
import { SourceMapNode } from "@shared/types/shared";
import { tryCatch } from "@shared/utils";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { DataLoaders } from "models/data-loaders";

import { NotFoundError } from "../errors";
import Series from "../models/series";

interface SeriesParams {
  id: number;
  offset: number;
  limit: number;
  name: string;
}

/**
 * Series - /series
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.route<{ Params: SeriesParams }>({
    method: "GET",
    url: "/series",
    schema: {
      querystring: {
        type: "object",
        properties: {
          offset: {
            type: "number",
            default: 0,
            description: "Number of records to skip",
          },
          limit: {
            type: "number",
            default: 40,
            description: "Maximum number of records to return",
          },
        },
      },
    },
    handler: async (request, response) => {
      const { offset, limit } = request.params;
      const { error, data } = await tryCatch<Series>(
        Series.getSummaryList(app.mysql, { offset, limit })
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError();
      }

      return { data, offset, limit };
    },
  });

  app.get<{ Params: SeriesParams }>(
    "/series/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
      },
    },
    async (request, response) => {
      const { id } = request.params;

      const { error, data } = await tryCatch(
        Series.getSeriesPageData(app.mysql, { id })
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError();
      }
      return { data };
    }
  );

  app.get<{ Params: SeriesParams }>(
    "/series/:id/source-map",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    async (request, response) => {
      const { id } = request.params;
      const { name } = request.query;

      app.log.info(`ROUTE id: ${id}, name: ${name}`);

      const { error, data } = await tryCatch(
        DataLoaders.getDependencies(app.mysql, { seriesName: name })
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError();
      }

      return { data };
    }
  );
}

export default routes;
