
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
 * Investigations
 * 
 * Investihations is for troubleshooting data issues within the app. Often issues related to
 * series load statements.
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/investigations", async (request, response) => {
    return { message: "investigations" };
  });

  app.get("/investigations/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;