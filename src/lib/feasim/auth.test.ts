import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { GET as defaults } from "@/app/api/feasim/defaults/route";
import { GET as gaugePathway } from "@/app/api/feasim/gauge/[pathway]/route";
import { GET as gaugeCompare } from "@/app/api/feasim/gauge/compare/route";

import {
  allowedOrigin,
  bearerKey,
  preflight,
  setApiKeyLookup,
  type ApiApp,
} from "./auth";
import { checkRateLimit, setRateLimit } from "./rate-limit";

const app = (hostname: string | null, id = 1): ApiApp => ({
  id,
  name: `app${id}`,
  hostname,
  universe: "UHERO",
});

// api_applications stand-in: one browser app, one server-side app
const KEYS: Record<string, ApiApp[]> = {
  "web-key": [app("dashboards.uhero.hawaii.edu")],
  "server-key": [app(null, 2)],
};
let lookups = 0;
beforeEach(() => {
  lookups = 0;
  setApiKeyLookup(async (k) => {
    lookups++;
    return KEYS[k] ?? [];
  });
});
afterAll(() => setApiKeyLookup());

const LOT = "lot_sqft=20000&zone_class=BMX-3&height=150";
function request(headers: Record<string, string> = {}, path = "bill6") {
  return gaugePathway(
    new NextRequest(`${process.env.AUTH_URL}/api/feasim/gauge/${path}?${LOT}`, {
      headers,
    }),
    { params: Promise.resolve({ pathway: path }) },
  );
}

describe("bearerKey", () => {
  test("reads `Authorization: Bearer <key>`, case-insensitively", () => {
    const r = (v: string) =>
      bearerKey(new Request("http://x", { headers: { authorization: v } }));
    expect(r("Bearer abc-123_x=")).toBe("abc-123_x=");
    expect(r("bearer abc")).toBe("abc");
    expect(r("abc")).toBeNull();
    expect(r("Basic abc")).toBeNull();
    expect(r(`Bearer ${"x".repeat(256)}`)).toBeNull();
  });
});

describe("authentication", () => {
  test("no key: 401 with how to send one", async () => {
    const res = await request();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect((await res.json()).issues[0]).toContain("Authorization: Bearer");
    expect(lookups).toBe(0);
  });

  test("unknown key: 401", async () => {
    const res = await request({ authorization: "Bearer nope" });
    expect(res.status).toBe(401);
    expect((await res.json()).issues).toEqual(["Invalid API key."]);
  });

  test("valid key: 200, privately cacheable, varying by key and origin", async () => {
    const res = await request({ authorization: "Bearer server-key" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(res.headers.get("vary")).toBe("Authorization, Origin");
    expect((await res.json()).result.max_units).toBe(140);
  });

  test("the key is checked before parameters", async () => {
    const res = await request({}, "bill8");
    expect(res.status).toBe(401);
  });

  test("errors after auth keep the key's headers", async () => {
    const res = await request({ authorization: "Bearer server-key" }, "bill8");
    expect(res.status).toBe(404);
    expect(res.headers.get("vary")).toBe("Authorization, Origin");
  });

  test("compare needs a key too", async () => {
    const res = await gaugeCompare(
      new NextRequest(
        `${process.env.AUTH_URL}/api/feasim/gauge/compare?${LOT}`,
      ),
    );
    expect(res.status).toBe(401);
  });

  test("a failed lookup is a 503, not a pass", async () => {
    setApiKeyLookup(async () => {
      throw new Error("db down");
    });
    const res = await request({ authorization: "Bearer web-key" });
    expect(res.status).toBe(503);
  });

  test("lookups are cached", async () => {
    for (let i = 0; i < 3; i++)
      await request({ authorization: "Bearer server-key" });
    expect(lookups).toBe(1);
  });

  test("defaults stay public", async () => {
    const d = defaults(
      new NextRequest(`${process.env.AUTH_URL}/api/feasim/defaults`),
    );
    expect(d.status).toBe(200);
  });
});

describe("CORS: browsers read results only on the key's hostname", () => {
  const web = KEYS["web-key"];

  test("no Origin (server, script, curl): no header needed", () => {
    expect(allowedOrigin(null, web)).toBeNull();
  });

  test("the hostname and its subdomains", () => {
    expect(allowedOrigin("https://dashboards.uhero.hawaii.edu", web)).toBe(
      "https://dashboards.uhero.hawaii.edu",
    );
    expect(allowedOrigin("https://beta.dashboards.uhero.hawaii.edu", web)).toBe(
      "https://beta.dashboards.uhero.hawaii.edu",
    );
  });

  test("localhost, for development", () => {
    expect(allowedOrigin("http://localhost:3000", web)).toBe(
      "http://localhost:3000",
    );
  });

  test("not a host that merely contains it (rest-api's substring match)", () => {
    expect(
      allowedOrigin("https://dashboards.uhero.hawaii.edu.evil.example", web),
    ).toBeNull();
    expect(
      allowedOrigin("https://xdashboards.uhero.hawaii.edu", web),
    ).toBeNull();
  });

  test("an app with no hostname is server-side only (rest-api allows all)", () => {
    expect(allowedOrigin("https://anything.example", [app(null)])).toBeNull();
    expect(allowedOrigin("https://anything.example", [app("")])).toBeNull();
  });

  test("a hostname saved with a scheme or path still matches", () => {
    expect(
      allowedOrigin("https://site.example", [app("https://site.example/app")]),
    ).toBe("https://site.example");
  });

  test("on a real request", async () => {
    const ok = await request({
      authorization: "Bearer web-key",
      origin: "https://dashboards.uhero.hawaii.edu",
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://dashboards.uhero.hawaii.edu",
    );
    const other = await request({
      authorization: "Bearer web-key",
      origin: "https://elsewhere.example",
    });
    expect(other.status).toBe(200); // served, but the browser won't expose it
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("preflight allows the Authorization header", () => {
    const res = preflight();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Authorization",
    );
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});

describe("rate limit: requests per minute per API key", () => {
  const server = { authorization: "Bearer server-key" };
  const env = process.env.FEASIM_RATE_LIMIT_PER_MINUTE;
  beforeEach(() => setRateLimit(3));
  afterAll(() => {
    if (env === undefined) delete process.env.FEASIM_RATE_LIMIT_PER_MINUTE;
    else process.env.FEASIM_RATE_LIMIT_PER_MINUTE = env;
    setRateLimit();
  });

  test("responses say where the key stands, readable by browsers", async () => {
    const res = await request(server);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("3");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("2");
    expect(Number(res.headers.get("x-ratelimit-reset"))).toBeWithin(1, 61);
    expect(res.headers.get("access-control-expose-headers")).toContain(
      "X-RateLimit-Remaining",
    );
  });

  test("over the limit: 429 with Retry-After, before running the model", async () => {
    for (let i = 0; i < 3; i++)
      expect((await request(server)).status).toBe(200);
    const res = await request(server);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeWithin(1, 61);
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect((await res.json()).issues[0]).toContain("limit of 3 requests");
  });

  test("each key has its own count", async () => {
    for (let i = 0; i < 4; i++) await request(server);
    expect((await request(server)).status).toBe(429);
    expect((await request({ authorization: "Bearer web-key" })).status).toBe(
      200,
    );
  });

  test("the count starts over each minute", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit(9, t).ok).toBeTrue();
    expect(checkRateLimit(9, t + 59_000).ok).toBeFalse();
    expect(checkRateLimit(9, t + 60_000).ok).toBeTrue();
  });

  test("FEASIM_RATE_LIMIT_PER_MINUTE sets it; 0 turns it off", async () => {
    setRateLimit(); // back to the env
    process.env.FEASIM_RATE_LIMIT_PER_MINUTE = "1";
    expect((await request(server)).status).toBe(200);
    expect((await request(server)).status).toBe(429);
    process.env.FEASIM_RATE_LIMIT_PER_MINUTE = "0";
    const res = await request(server);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBeNull();
  });

  test("default: 600 a minute", async () => {
    setRateLimit();
    delete process.env.FEASIM_RATE_LIMIT_PER_MINUTE;
    const res = await request(server);
    expect(res.headers.get("x-ratelimit-limit")).toBe("600");
  });
});
