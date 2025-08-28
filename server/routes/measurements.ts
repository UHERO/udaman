
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
 * Measurements
 * 
 * in a series like 1Q84@HI.A,1Q84 is the measurement. It specifies to point of a series.
 * A measurement likely includes multiples series, for example:
 * 
 * - 1Q84@HI.A, 1Q84@HI.Q, 1Q84@HI.M - for annual quarterly and monthly versions of a measurement
 * - 1Q84@MAU.A, 1Q84@KAU.A, 1Q84@HI.A - for Maui, Kaui, and State versions of a series.
 * 
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get("/measurements", async (request, response) => {
    return { message: "measurements" };
  });

  app.get("/measurements/:id", { schema }, async (request, response) => {
    const { id } = request.params;
    return { series: 200, message: id };
  });
}

export default routes;