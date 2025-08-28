
import { FastifyInstance, FastifyPluginOptions } from "fastify";


const seriesBodySchema = {
  type: "object",
  properties: {
    id: { type: "number" },
  },
  required: ["id"],
};

const schema = {
  params: seriesBodySchema,
};

/**
 * Exports
 * 
 * for exporting series data as csv,table, etc
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/exports", async (request, response) => {
    return { message: "exports" };
  });

  app.get("/exports/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;