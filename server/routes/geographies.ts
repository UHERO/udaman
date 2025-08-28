
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
 * Geographies
 * 
 * in a series like 1Q84@HI.A, 'HI' is the geography. This denotes where this series applies to.
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/geographies", async (request, response) => {
    return { message: "geographies" };
  });

  app.get("/geographies/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;