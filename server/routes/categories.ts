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
 * Categories
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/categories", async (request, response) => {
    return { message: "categories" };
  });

//   app.get("/categories/:id", { schema }, async (request, response) => {
//     const { id } = request.params;
//     return { series: 200, message: id };
//   });

  app.route({
    method: 'GET',
    url: '/categories/:id/:name/:exitement',
    schema: {
        querystring: {
        type: 'object',
        properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            excitement: { type: 'integer' }
            }
        },
        response: {
        200: {
            type: 'object',
            properties: {
            hello: { type: 'string' }
            }
        }
    }
  },
  handler: function (request, reply) {
    reply.send({ hello: 'world' })
  }
})
}

export default routes;
