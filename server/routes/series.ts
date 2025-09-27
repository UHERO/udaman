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

interface SeriesDeleteParams {
  u: Universe;
  date: string;
  deleteBy: "observationDate" | "vintageDate" | "none";
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
      const data = await Series.getSummaryList({ offset, limit, universe: u });

      if (data.length === 0) {
        response.code(404);
        return { error: "No series found" };
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

      const data = await Series.getSeriesPageData({ id });

      if (!data) {
        response.code(404);
        return { error: "No series found" };
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
      const { name } = request.query;

      const data = await DataLoaders.getDependencies({ seriesName: name });

      if (data.length === 0) {
        response.code(404);
        return { error: "No Source-map found" };
      }

      return { data };
    },
  });

  app.route<{
    Params: SeriesRouteParams;
    Querystring: SeriesDeleteParams;
  }>({
    method: "DELETE",
    url: "/series/:id/delete",
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
          u: { type: "string" },
          date: { type: "string" },
          deleteBy: { type: "string" },
        },
        required: ["u", "date", "deleteBy"],
      },
    },
    handler: async (request, response) => {
      const { id } = request.params;
      const { u, date, deleteBy } = request.query;

      app.log.info(`DELETE: /series/${id}/delete`);

      const { error, data } = await tryCatch(
        Series.deleteDataPoints({ id, u, date, deleteBy })
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
