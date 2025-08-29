// import { tryCatch } from "../helpers/trycatch";
import { tryCatch } from "@shared/utils";
import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { NotFoundError } from "../errors";
import Series from "../models/series";

interface SeriesParams {
  id: string;
  offset: number;
  limit: number;
}

const listOpts = {
  schema: {
    params: {
      type: "object",
      properties: {
        offset: { type: "number", default: 0 },
        limit: { type: "number", default: 40 },
      },
    },
  },
};

const singleOpts = {
  schema: {
    params: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
};

/**
 * Series
 */
async function routes(app: FastifyInstance, options: FastifyPluginOptions) {
  app.get<{ Params: SeriesParams }>(
    "/series",
    listOpts,
    async (request, response) => {
      const { offset, limit } = request.params;
      const { error, data } = await tryCatch<Series>(
        Series.getSummaryList(app.mysql, { offset, limit })
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError();
      }

      return { data, offset, limit };
    }
  );

  app.get<{ Params: SeriesParams }>(
    "/series/:id",
    singleOpts,
    async (request, response) => {
      const { id } = request.params;

      const { error, data } = await tryCatch<Series>(
        Series.find(app.mysql, { id })
      );

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError();
      }

      return { data };
    }
  );
}

export default routes;
