import { FastifyInstance, FastifyPluginOptions } from "fastify";
/* Downloads is for downloading the file a series is derived from. Possibly other uses as well. */import { FastifyInstance, FastifyPluginOptions, FastifySchema } from "fastify";

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
 * Downloads
 * 
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/downloads", async (request, response) => {
    return { message: "downloads" };
  });

  app.get("/downloads/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;
