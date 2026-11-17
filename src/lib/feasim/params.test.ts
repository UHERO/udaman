import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { calcParcel, calcSingle, overallLevel } from "@uhero/feasim";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { GET as calcPathway } from "@/app/api/feasim/calculator/[pathway]/route";
import { GET as calcCompare } from "@/app/api/feasim/calculator/compare/route";
import { GET as defaults } from "@/app/api/feasim/defaults/route";
import { GET as gaugePathway } from "@/app/api/feasim/gauge/[pathway]/route";
import { GET as gaugeCompare } from "@/app/api/feasim/gauge/compare/route";

import { setApiKeyLookup } from "./auth";
import { calculatorCases } from "./calculator-cases";
import calculatorDefaults from "./fixtures/calculator-defaults.json";
import gaugeParcels from "./fixtures/gauge-parcels.json";
import { gaugeCases } from "./gauge-cases";
import leverPathways from "./generated/lever-pathways.json";
import { leverChangesResult } from "./lever-pathways";
import {
  FEASIM_VERSION,
  LEVERS,
  ParamError,
  parseFeasimQuery,
  parsePathway,
  parsePrograms,
  PROGRAMS,
  TOD_TIERS,
  type LeverName,
} from "./params";
import { setRateLimit } from "./rate-limit";

const q = (s: string) => new URLSearchParams(s);
const issuesOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ParamError) return e.issues;
    throw e;
  }
  throw new Error("expected ParamError");
};
// a stand-in for api_applications, so route tests need no database
const KEY = "test-key";
beforeAll(() => {
  setApiKeyLookup(async (k) =>
    k === KEY
      ? [{ id: 1, name: "test", hostname: null, universe: "UHERO" }]
      : [],
  );
  // the gauge check alone sends 713 requests on one key
  setRateLimit(0);
});
afterAll(() => {
  setApiKeyLookup();
  setRateLimit();
});
const AUTH = { authorization: `Bearer ${KEY}` };

const get = async (
  handler: (r: NextRequest) => Response | Promise<Response>,
  query: string,
) =>
  handler(
    new NextRequest(`${process.env.AUTH_URL}/api/feasim/x?${query}`, {
      headers: AUTH,
    }),
  );
const getPathway = (
  handler: typeof gaugePathway,
  pathway: string,
  query: string,
) =>
  handler(
    new NextRequest(
      `${process.env.AUTH_URL}/api/feasim/x/${pathway}?${query}`,
      {
        headers: AUTH,
      },
    ),
    {
      params: Promise.resolve({ pathway }),
    },
  );

const LOT = "lot_sqft=20000&zone_class=BMX-3&height=150";

describe("FEASIM_VERSION", () => {
  test("matches the installed package", () => {
    const pkg = JSON.parse(
      readFileSync("node_modules/@uhero/feasim/package.json", "utf8"),
    );
    expect(FEASIM_VERSION).toBe(pkg.version);
  });

  test.each([
    ["calculator-defaults.json", calculatorDefaults._feasim_version],
    ["gauge-parcels.json", gaugeParcels._feasim_version],
    ["generated/lever-pathways.json", leverPathways._feasim_version],
  ])("fixture %s is from the same version", (file, version) => {
    // after bumping @uhero/feasim: bun scripts/update-feasim-fixtures.ts
    expect(
      version,
      `${file} is from another feasim version; run \`bun scripts/update-feasim-fixtures.ts\``,
    ).toBe(FEASIM_VERSION);
  });
});

/**
 * The pathway lists in LEVERS come from generated/lever-pathways.json; this
 * checks that file is current for the installed model.
 */
describe("lever pathways match the model", () => {
  for (const program of PROGRAMS)
    test(program, () => {
      for (const name of Object.keys(LEVERS) as LeverName[]) {
        const spec = LEVERS[name];
        const listed = !spec.pathways || spec.pathways.includes(program);
        expect(
          leverChangesResult(program, name),
          `${name} ${listed ? "is listed for" : "is not listed for"} ${program}, but the model says otherwise: run \`bun scripts/update-feasim-levers.ts\``,
        ).toBe(listed);
      }
    });
});

describe("parseFeasimQuery", () => {
  test("gauge/bill6: parcel, levers, parking exemption", () => {
    const r = parseFeasimQuery(
      q(`${LOT}&tmk=123&land_cost=250&parking_exempt=1&unit_type=third_each`),
      "gauge",
      ["bill6"],
    );
    expect(r.parcel).toEqual({
      lot_sqft: 20000,
      zone_class: "BMX-3",
      height: 150,
      tmk: "123",
      parking_exempt: true,
    });
    expect(r.levers).toEqual({ land_cost: 250, unit_type: "third_each" });
    expect(r.opts).toEqual({});
  });

  test("gauge/tod: TOD fields and tier", () => {
    const r = parseFeasimQuery(
      q(`${LOT}&tod_regime=pdt&slu_urban=true&tod_precinct=tiz&tier=minor_sd`),
      "gauge",
      ["tod"],
    );
    expect(r.parcel.tod_regime).toBe("pdt");
    expect(r.parcel.tod_precinct).toBe("tiz");
    expect(r.opts).toEqual({ tier: "minor_sd" });
  });

  test("calculator: applies the calculator's TOD assumptions", () => {
    const r = parseFeasimQuery(
      q(`${LOT}&tod_regime=pdt&tier=major_sd`),
      "calculator",
      ["tod"],
    );
    expect(r.parcel).toMatchObject({ slu_urban: true, tod_precinct: "core" });
    expect(r.opts).toEqual({ tier: "major_sd", generous_height: true });
  });

  test("rejects inputs another pathway reads, saying which", () => {
    const issues = issuesOf(() =>
      parseFeasimQuery(
        q(
          `${LOT}&grant_type=pre_construct&tier=base&affordability=0.6&tod_regime=pdt`,
        ),
        "gauge",
        ["bill6"],
      ),
    );
    expect(issues).toEqual([
      "grant_type: applies only to bill7; the bill6 model ignores it",
      "tier: applies only to tod; the bill6 model ignores it",
      "affordability: applies only to h201; the bill6 model ignores it",
      "tod_regime: applies only to tod; the bill6 model ignores it",
    ]);
  });

  test("rejects gauge-only fields on the calculator", () => {
    const issues = issuesOf(() =>
      parseFeasimQuery(q(`${LOT}&tmk=1&parking_exempt=true`), "calculator", [
        "bill6",
      ]),
    );
    expect(issues).toEqual([
      "tmk: gauge endpoints only, not calculator",
      "parking_exempt: gauge endpoints only, not calculator",
    ]);
  });

  test("normalizes zone case", () => {
    const zone = (z: string) =>
      parseFeasimQuery(q(`lot_sqft=1&zone_class=${z}`), "gauge", ["bill6"])
        .parcel.zone_class;
    expect(zone("bmx-3")).toBe("BMX-3");
    expect(zone("APARTMIX")).toBe("ApartMix");
  });

  test("rejects unknown zones, params and duplicates", () => {
    const issues = issuesOf(() =>
      parseFeasimQuery(
        q("lot_sqft=1&zone_class=XYZ&land_cots=5&height=1&height=2"),
        "gauge",
        ["bill6"],
      ),
    ).join("\n");
    expect(issues).toContain("zone_class");
    expect(issues).toContain("land_cots: unknown parameter");
    expect(issues).toContain("height: given more than once");
  });

  test("requires lot_sqft and zone_class", () => {
    expect(issuesOf(() => parseFeasimQuery(q(""), "gauge", ["bill6"]))).toEqual(
      ["lot_sqft: required", "zone_class: required"],
    );
  });

  test("rejects values the model would silently mishandle", () => {
    const issues = issuesOf(() =>
      parseFeasimQuery(
        q(
          `${LOT}&permanent_rate=0&affordable_ami=ami_85&grant_type=foo&equity=abc&include_retail=yes`,
        ),
        "gauge",
        ["bill7"],
      ),
    ).join("\n");
    for (const k of [
      "permanent_rate",
      "affordable_ami",
      "grant_type",
      "equity",
      "include_retail",
    ])
      expect(issues).toContain(k);
    expect(
      issuesOf(() =>
        parseFeasimQuery(q(`${LOT}&affordability=0.4`), "gauge", ["h201"]),
      )[0],
    ).toContain("affordability: must be at least 0.51");
  });
});

describe("pathway parsing", () => {
  test("parsePathway", () => {
    expect(parsePathway("TOD")).toBe("tod");
    expect(parsePathway("bill8")).toBeNull();
  });

  test("parsePrograms", () => {
    expect(parsePrograms(q(""))).toHaveLength(5);
    expect(parsePrograms(q("programs=bill7,tod,bill7"))).toEqual([
      "bill7",
      "tod",
    ]);
  });
});

/**
 * feasim's own calculator fixtures (UHERO/feasim test/data, v0.3.0): the
 * calcSingle inputs the calculator builds at each pathway's defaults. The
 * calculator endpoint, given only what a calculator user sets, must
 * reproduce calcSingle on each exactly.
 */
describe("calculator mode matches feasim's calculator fixtures", () => {
  // see the visual report: bun run report:feasim
  test.each(calculatorCases().map((c) => [c.name, c] as const))(
    "%s",
    async (_name, { inputs, query }) => {
      const res = getPathway(calcPathway, inputs.program, query.toString());
      expect((await res).status).toBe(200);
      const body = await (await res).json();
      // through JSON, as a caller sees it
      expect(body.result).toEqual(
        JSON.parse(JSON.stringify(calcSingle(inputs))),
      );
    },
  );
});

/**
 * feasim's gauge sample (UHERO/feasim test/data): real parcels, TOD at every
 * tier. The gauge endpoint, given a parcel as query parameters, must give
 * what the gauge gets from calcParcel on it: the same envelope and result.
 */
describe("gauge mode matches the gauge on feasim's parcel sample", () => {
  // see the visual report: bun run report:feasim
  test("every sample parcel, at every TOD tier", async () => {
    const cases = gaugeCases();
    expect(cases.length).toBeGreaterThan(500);
    for (const c of cases) {
      const label = `${c.program} ${c.parcel.tmk}${c.tier ? ` ${c.tier}` : ""}`;
      const res = await getPathway(gaugePathway, c.program, c.query.toString());
      expect(res.status, label).toBe(200);
      const body = await res.json();
      const { envelope, result } = c.expected();
      expect(body.result, label).toEqual(JSON.parse(JSON.stringify(result)));
      expect(body.envelope, label).toEqual(
        JSON.parse(JSON.stringify(envelope)),
      );
    }
  });
});

describe("gauge/{pathway}", () => {
  // feasim's README example lot. Its numbers aren't hard-coded here: they
  // change with model versions, which the API snapshots catch.
  test("bill6: the response for feasim's README example lot", async () => {
    const res = await getPathway(gaugePathway, "bill6", LOT);
    expect(res.status).toBe(200);
    // keyed: privately cacheable; CORS only for a browser on the key's hostname
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    const body = await res.json();
    expect(body.model.version).toBe(FEASIM_VERSION);
    expect(body.mode).toBe("gauge");
    expect(body.program).toBe("bill6");
    const expected = calcParcel("bill6", {
      lot_sqft: 20000,
      zone_class: "BMX-3",
      height: 150,
    });
    expect(body.result).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(body.verdict.overall).toBe(overallLevel(expected));
  });

  test("bill7 takes its grant levers", async () => {
    const body = await (
      await getPathway(gaugePathway, "bill7", `${LOT}&grant_type=pre_construct`)
    ).json();
    expect(body.levers).toEqual({ grant_type: "pre_construct" });
    expect(body.result.pre_construction_subsidy).toBeGreaterThan(0);
  });

  test("bill6 rejects them", async () => {
    const res = await getPathway(
      gaugePathway,
      "bill6",
      `${LOT}&grant_type=pre_construct`,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0]).toContain("applies only to bill7");
  });

  test("an unknown pathway is a 404", async () => {
    const res = await getPathway(gaugePathway, "bill8", LOT);
    expect(res.status).toBe(404);
    expect((await res.json()).issues[0]).toContain("bill6, standard");
  });

  test("fields trims the result and rejects unknown fields", async () => {
    const body = await (
      await getPathway(gaugePathway, "bill6", `${LOT}&fields=max_units,dev_roc`)
    ).json();
    expect(Object.keys(body.result)).toEqual(["max_units", "dev_roc"]);
    const bad = await getPathway(gaugePathway, "bill6", `${LOT}&fields=nope`);
    expect(bad.status).toBe(400);
  });
});

describe("compare", () => {
  test("applies each lever only where its pathway reads it", async () => {
    const body = await (
      await get(
        gaugeCompare,
        `${LOT}&programs=bill6,bill7&grant_type=pre_construct&land_cost=200`,
      )
    ).json();
    expect(body.programs).toEqual(["bill6", "bill7"]);
    const [bill6, bill7] = body.results;
    expect(bill6.levers).toEqual({ land_cost: 200 });
    expect(bill7.levers).toEqual({
      grant_type: "pre_construct",
      land_cost: 200,
    });
  });

  test("rejects a lever no selected pathway reads", async () => {
    const res = await get(
      gaugeCompare,
      `${LOT}&programs=bill6,tod&grant_type=none`,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0]).toBe(
      "grant_type: applies only to bill7; the bill6, tod model ignores it",
    );
  });

  test("a lot outside the TOD districts is ineligible", async () => {
    const body = await (await get(gaugeCompare, `${LOT}&programs=tod`)).json();
    expect(body.results[0].envelope.status).toBe("ineligible");
  });

  test("a bad programs list still reports every other issue", async () => {
    const res = await get(
      gaugeCompare,
      "programs=bill9&zone_class=A-2&land_cots=1",
    );
    const issues: string[] = (await res.json()).issues;
    for (const k of ["programs", "lot_sqft", "land_cots"])
      expect(
        issues.some((i) => i.startsWith(k)),
        k,
      ).toBeTrue();
  });

  test("calculator: runs every pathway by default", async () => {
    const body = await (
      await get(calcCompare, "lot_sqft=10000&zone_class=A-1&height=30")
    ).json();
    expect(body.results).toHaveLength(5);
  });
});

/**
 * Behaviors found by cross-checking against the Housing Policy Simulator
 * (uhero_analytics app/housing/policy) — each was a mismatch once.
 */
describe("matches the calculator page", () => {
  const body = async (pathway: string, query: string) => {
    const res = await getPathway(calcPathway, pathway, query);
    expect(res.status).toBe(200);
    return res.json();
  };

  test("bill7: height is used as given, past the 60 ft statutory cap", async () => {
    const calc = await body("bill7", "lot_sqft=10000&zone_class=A-1&height=90");
    expect(calc.result.height_limit).toBe(90);
    // the gauge, on a real parcel, caps it
    const gauge = await (
      await getPathway(
        gaugePathway,
        "bill7",
        "lot_sqft=10000&zone_class=A-1&height=90",
      )
    ).json();
    expect(gauge.result.height_limit).toBe(60);
  });

  test("an explicit height_limit still wins", async () => {
    const r = await body(
      "bill7",
      "lot_sqft=10000&zone_class=A-1&height=90&height_limit=40",
    );
    expect(r.result.height_limit).toBe(40);
  });

  test("tod: takes station area and precinct; regime defaults to ipdt", async () => {
    const r = await body(
      "tod",
      "lot_sqft=20000&zone_class=AMX-1&height=30&tod_precinct=tiz&station_area=East%20Kapolei",
    );
    expect(r.parcel).toMatchObject({
      tod_regime: "ipdt",
      tod_precinct: "tiz",
      station_area: "East Kapolei",
      slu_urban: true,
    });
  });

  test("tod: station area is case-insensitive and gets its plan", async () => {
    const r = await body(
      "tod",
      "lot_sqft=40000&zone_class=AMX-2&height=60&tier=with_benefits&station_area=ala%20moana",
    );
    expect(r.parcel.station_area).toBe("Ala Moana");
    expect(r.envelope).toMatchObject({
      far_source: "plan_ceiling",
      max_far: 10,
      height_limit: 400,
    });
  });

  test("tod: rejects an unknown station area", async () => {
    const res = await getPathway(
      calcPathway,
      "tod",
      "lot_sqft=40000&zone_class=AMX-2&height=60&station_area=Nowhere",
    );
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0]).toStartWith("station_area:");
  });

  test("the envelope reports the height the model ran", async () => {
    const r = await body("bill7", "lot_sqft=10000&zone_class=A-2&height=100");
    expect(r.result.height_limit).toBe(100);
    expect(r.envelope.height_limit).toBe(100);
  });

  test("tod: accepts the resort districts, case-insensitively", async () => {
    for (const z of ["Resort", "rescom", "RESMIX"]) {
      const r = await body("tod", `lot_sqft=20000&zone_class=${z}&height=30`);
      expect(["Resort", "ResCom", "ResMix"]).toContain(r.parcel.zone_class);
    }
  });

  test("accepts the calculator's slider ranges", async () => {
    await body(
      "bill6",
      "lot_sqft=10000&zone_class=A-1&height=30&market_ami=ami_180&hold_years=0",
    );
  });

  test("non-TOD calculator runs don't carry TOD defaults", async () => {
    const r = await body("bill6", "lot_sqft=10000&zone_class=A-1&height=30");
    expect(r.parcel.tod_regime).toBeUndefined();
  });
});

describe("calculator/tod", () => {
  test("higher PD-T tiers raise the height", async () => {
    const heights = await Promise.all(
      TOD_TIERS.map(async (tier) => {
        const body = await (
          await getPathway(
            calcPathway,
            "tod",
            `lot_sqft=20000&zone_class=AMX-1&height=30&tod_regime=pdt&tier=${tier}`,
          )
        ).json();
        expect(body.mode).toBe("calculator");
        return body.envelope.height_limit;
      }),
    );
    expect(heights).toEqual([30, 60, 90, 90]);
  });
});

describe("/defaults", () => {
  test("lists pathways and levers with their pathways", async () => {
    const body = await (await get(defaults, "program=tod")).json();
    expect(Object.keys(body.defaults)).toEqual(["tod"]);
    expect(body.levers.land_cost.type).toBe("number");
    expect(body.levers.grant_type.pathways).toEqual(["bill7"]);
  });

  test("rejects an unknown program", async () => {
    expect((await get(defaults, "program=bill9")).status).toBe(400);
  });
});
