import { Universe } from "@shared/types/shared";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import Geographies from "models/geographies";

type GeographyParams = { id: number };
type GeographyListQuery = { u?: Universe };

const geographyParamsSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
  },
  required: ["id"],
};

const geographyListQuerySchema = {
  type: "object",
  properties: {
    u: { type: "string" },
  },
};

async function routes(app: FastifyInstance, _options: FastifyPluginOptions) {
  // List all geographies per universe
  app.route<{ Querystring: GeographyListQuery }>({
    method: "GET",
    url: "/geographies",
    schema: {
      querystring: geographyListQuerySchema,
    },
    handler: async (request) => {
      const { u } = request.query;
      const data = await Geographies.list({ universe: u });
      return { data };
    },
  });

  // Get a single geography by ID
  app.route<{ Params: GeographyParams }>({
    method: "GET",
    url: "/geographies/:id",
    schema: {
      params: geographyParamsSchema,
    },
    handler: async (request) => {
      const { id } = request.params;
      const data = await Geographies.getById(id);
      return { data };
    },
  });
}

export default routes;
