import { FastifyInstance, FastifyPluginOptions, FastifySchema } from "fastify";


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
 * Data Lists
 * 
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/data-lists", async (request, response) => {
    return { message: "data-lists" };
  });

  app.get("/data-lists/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;
