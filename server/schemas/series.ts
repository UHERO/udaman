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
