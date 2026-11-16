import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { GET as calcPathway } from "@/app/api/feasim/calculator/[pathway]/route";
import { GET as calcCompare } from "@/app/api/feasim/calculator/compare/route";
import { GET as defaults } from "@/app/api/feasim/defaults/route";
import { GET as gaugePathway } from "@/app/api/feasim/gauge/[pathway]/route";
import { GET as gaugeCompare } from "@/app/api/feasim/gauge/compare/route";

import { setApiKeyLookup } from "./auth";
import { EXAMPLES } from "./docs-content";
import { PROGRAMS, type FeasimMode } from "./params";

const MODES: FeasimMode[] = ["gauge", "calculator"];
const isPathway = (seg: string) =>
  (PROGRAMS as readonly string[]).includes(seg);

// a stand-in for api_applications, so the examples run without a database
beforeAll(() =>
  setApiKeyLookup(async (k) =>
    k === "test-key"
      ? [{ id: 1, name: "test", hostname: null, universe: "UHERO" }]
      : [],
  ),
);
afterAll(() => setApiKeyLookup());

/** Call the handler serving an endpoint path. */
async function call(path: string, query: string): Promise<Response> {
  const req = new NextRequest(
    `${process.env.AUTH_URL}/api/feasim${path}?${query}`,
    {
      headers: { authorization: "Bearer test-key" },
    },
  );
  const [, mode, last] = path.split("/");
  if (last && isPathway(last)) {
    const handler = mode === "gauge" ? gaugePathway : calcPathway;
    return handler(req, { params: Promise.resolve({ pathway: last }) });
  }
  const handler = {
    "/gauge/compare": gaugeCompare,
    "/calculator/compare": calcCompare,
    "/defaults": defaults,
  }[path];
  if (!handler) throw new Error(`no handler for ${path}`);
  return handler(req);
}

describe("docs examples", () => {
  test("one per mode and pathway, plus compare and defaults", () => {
    const expected = [
      ...MODES.flatMap((m) => [
        ...PROGRAMS.map((p) => `/${m}/${p}`),
        `/${m}/compare`,
      ]),
      "/defaults",
    ];
    expect(Object.keys(EXAMPLES).sort()).toEqual(expected.sort());
  });

  test.each(Object.entries(EXAMPLES))(
    "example %s returns 200",
    async (path, query) => {
      expect((await call(path, query)).status).toBe(200);
    },
  );
});
