import { Universe } from "@shared/types/shared";
import { tryCatch } from "@shared/utils";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { DataLoaders } from "models/data-loaders";

import { NotFoundError } from "../errors";
import Series from "../models/series";

interface SeriesQueryParams {
  offset?: number;
  limit?: number;
  u: Universe;
}

interface SeriesRouteParams {
  id: number;
}

interface SourceMapQuery {
  name: string;
}

/**
 * Series Routes
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.route<{ Querystring: SeriesQueryParams }>({
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
          u: {
            type: "string",
            default: "UHERO",
            description: "Data universe",
          },
        },
      },
    },
    handler: async (request, response) => {
      const { offset, limit, u } = request.query;
      const { error, data } = await tryCatch<Series>(
        Series.getSummaryList(app.mysql, { offset, limit, universe: u })
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
  app.route<{ Params: SeriesRouteParams }>({
    method: "GET",
    url: "/series/:id",
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        required: ["id"],
      },
    },
    handler: async (request, response) => {
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
    },
  });

  app.route<{
    Params: SeriesRouteParams;
    Querystring: SourceMapQuery;
  }>({
    method: "GET",
    url: "/series/:id/source-map",
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
    handler: async (request, response) => {
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
    },
  });
}

export default routes;
