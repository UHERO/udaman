import { Universe } from "@shared/types/shared";
import { CreateLoaderFormData } from "@shared/types/sources";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { DataLoaders } from "models/data-loaders";

interface Params {
  id: number;
}
interface LoaderQueryString {
  seriesId: number;
  u: string;
}

/**
 * Data Loaders, previously data sources. Changed to avoid similar naming with other "sources" table
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.route({
    method: "GET",
    url: "/data-loaders",
    handler: async (request, response) => {
      return { message: "Not implemented: get data-loaders list" };
    },
  });
  app.route<{
    Params: Params;
    QueryString: LoaderQueryString;
  }>({
    method: "GET",
    url: "/data-loaders/:id",
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
      },
    },
    handler: async (request, response) => {
      const { id } = request.params;
      return {
        series: 200,
        message: "Not implemented: get data-loaders " + id,
      };
    },
  });

  app.route<{
    Params: Params;
    Querystring: LoaderQueryString;
    Body: CreateLoaderFormData;
  }>({
    method: "POST",
    url: "/data-loaders/new",
    schema: {
      querystring: {
        type: "object",
        properties: { seriesId: { type: "number" }, u: { type: "string" } },
        required: ["seriesId", "u"],
      },
      body: {
        type: "object",
        properties: {
          code: { type: "string" },
          priority: { type: "number" },
          scale: { type: "number" },
          presaveHook: { type: "string" },
          clearBeforeLoad: { type: "boolean" },
          pseudoHistory: { type: "boolean" },
        },
        required: [
          "code",
          "priority",
          "scale",
          "presaveHook",
          "clearBeforeLoad",
          "pseudoHistory",
        ],
        additionalProperties: false,
      },
    },
    handler: async (request, response) => {
      const { seriesId, u } = request.query;
      const payload = request.body;
      console.log(payload);

      const res = DataLoaders.create({
        ...payload,
        universe: u as Universe,
        seriesId: seriesId,
      });

      return {
        series: 200,
        message: { ...payload, universe: u, seriesId: seriesId },
      };
    },
  });
}

export default routes;
