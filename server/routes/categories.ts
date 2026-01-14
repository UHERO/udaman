import { Universe } from "@shared/types/shared";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import Categories, {
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from "models/categories";
type CategoryParams = { id: number };
type CategoryListQuery = { u?: Universe; excludeId?: number };

// schema for retrieving a single category
const categoryParamsSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
  },
  required: ["id"],
};

// schema for listing categories with universe and excludeId filters
const categoryListQuerySchema = {
  type: "object",
  properties: {
    u: { type: "string", default: "UHERO" },
    excludeId: { type: "number" },
  },
  required: ["u"],
};

// shared properties for create and update category payloads
const baseCategoryBodySchema = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    dataListId: { type: ["number", "null"] },
    defaultGeoId: { type: ["number", "null"] },
    defaultFreq: { enum: ["A", "S", "Q", "M", "W", "D", null] },
    universe: { type: "string" },
    header: { type: "boolean" },
    masked: { type: "boolean" },
    hidden: { type: "boolean" },
  },
};

const createCategoryBodySchema = {
  type: "object",
  properties: {
    parentId: { type: ["number", "null"] },
    ...baseCategoryBodySchema.properties,
  },
  // only allow properties defined in the schema
  additionalProperties: false,
};

// schema for updating a category
const updateCategoryBodySchema = {
  type: "object",
  properties: {
    ...baseCategoryBodySchema.properties,
    listOrder: { type: ["number", "null"] },
    meta: { type: ["string", "null"] },
  },
  // only allow properties defined in the schema
  additionalProperties: false,
};

/*************************************************************************
 * CATEGORIES CRUD ROUTES
 * GET: /categories              returns a list of categories
 * GET: /categories/:id          returns a single category by id
 * GET: /categories/:id/tree     returns the category tree starting from a specified category id
 * POST: /categories             creates a new category
 * PATCH: /categories/:id        updates an existing category
 * DELETE: /categories/:id       deletes a category
 *************************************************************************/
async function routes(app: FastifyInstance, _options: FastifyPluginOptions) {
  /* 
    get a list of categories with optional universe and excludeId filters
    example: /categories?u=UHERO&excludeId=5
  */
  app.route<{ Querystring: CategoryListQuery }>({
    method: "GET",
    url: "/categories",
    schema: {
      querystring: categoryListQuerySchema,
    },
    handler: async (request) => {
      const { excludeId, u = "UHERO" } = request.query;
      const data = await Categories.list({
        universe: u,
        excludeId,
      });
      return { data };
    },
  });

  // get a single category by id
  app.route<{ Params: CategoryParams }>({
    method: "GET",
    url: "/categories/:id",
    schema: {
      params: categoryParamsSchema,
    },
    handler: async (request) => {
      const { id } = request.params;
      const data = await Categories.getById(id);
      return { data };
    },
  });

  // get the category tree starting from a specified category id
  app.route<{ Params: CategoryParams }>({
    method: "GET",
    url: "/categories/:id/tree",
    schema: {
      params: categoryParamsSchema,
    },
    handler: async (request) => {
      const { id } = request.params;
      const data = await Categories.getTree(id);
      return { data };
    },
  });

  // create a new category
  app.route<{ Body: CreateCategoryPayload }>({
    method: "POST",
    url: "/categories",
    schema: {
      body: createCategoryBodySchema,
    },
    handler: async (request, reply) => {
      const payload = request.body;
      const data = await Categories.create(payload);
      reply.code(201);
      return { data };
    },
  });

  // update an existing category
  app.route<{ Params: CategoryParams; Body: UpdateCategoryPayload }>({
    method: "PATCH",
    url: "/categories/:id",
    schema: {
      params: categoryParamsSchema,
      body: updateCategoryBodySchema,
    },
    handler: async (request) => {
      const { id } = request.params;
      const payload = request.body;
      const data = await Categories.update(id, payload);
      return { data };
    },
  });

  // delete a category
  app.route<{ Params: CategoryParams }>({
    method: "DELETE",
    url: "/categories/:id",
    schema: {
      params: categoryParamsSchema,
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      await Categories.delete(id);
      reply.code(204);
    },
  });
}

export default routes;
