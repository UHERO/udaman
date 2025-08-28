import { FastifyInstance, FastifyPluginOptions } from "fastify";


/**
 * Homepage
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/", async (request, response) => {
    return { status: 200, message: "Hi, you've reached the homepage" };
  });

}

export default routes;
