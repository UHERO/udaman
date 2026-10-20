import { describe, expect, test } from "bun:test";

import { spec as bea } from "./bea";
import { spec as bls } from "./bls";
import { spec as eia } from "./eia";
import { spec as estatjp } from "./estatjp";
import { spec as fred } from "./fred";
import { rewriteEval } from "./lib";

const rewritten = (s: Parameters<typeof rewriteEval>[0], e: string) => {
  const r = rewriteEval(s, e);
  if (!r.ok) throw new Error(r.reason);
  return r.eval;
};
const reason = (s: Parameters<typeof rewriteEval>[0], e: string) => {
  const r = rewriteEval(s, e);
  return r.ok ? null : r.reason;
};

describe("migrate-api converters", () => {
  test("bls: both methods, chained calls kept", () => {
    expect(rewritten(bls, `Series.load_api_bls("CUURS24BSA0", "M")`)).toBe(
      `Series.load_from_extract("bls", { series_id: "CUURS24BSA0", frequency: "M" })`,
    );
    expect(rewritten(bls, `Series.load_api_bls_NEW("cuurs24bsa0", "S")`)).toBe(
      `Series.load_from_extract("bls", { series_id: "CUURS24BSA0", frequency: "S" })`,
    );
    expect(
      rewritten(
        bls,
        `Series.load_api_bls("CUURA421SA0", "M").trim("1941-01-01")`,
      ),
    ).toBe(
      `Series.load_from_extract("bls", { series_id: "CUURA421SA0", frequency: "M" }).trim("1941-01-01")`,
    );
    expect(
      rewritten(
        bls,
        `Series.load_api_bls("A", "M") + Series.load_api_bls_NEW("B", "M")`,
      ),
    ).toBe(
      `Series.load_from_extract("bls", { series_id: "A", frequency: "M" }) + Series.load_from_extract("bls", { series_id: "B", frequency: "M" })`,
    );
    expect(reason(bls, `Series.load_api_bls("X", "M", 2000, 2010)`)).toMatch(
      /year range/,
    );
  });

  test("fred: aggregation kept when given", () => {
    expect(
      rewritten(fred, `Series.load_api_fred("MORTGAGE30US", "Q","avg")`),
    ).toBe(
      `Series.load_from_extract("fred", { series_id: "MORTGAGE30US", frequency: "Q", aggregation: "avg" })`,
    );
    expect(rewritten(fred, `Series.load_api_fred("ANFCI", "W")`)).toBe(
      `Series.load_from_extract("fred", { series_id: "ANFCI", frequency: "W" })`,
    );
    expect(reason(fred, `Series.load_api_fred("X", "M", "median")`)).toMatch(
      /aggregation/,
    );
  });

  test("bea: Regional kwargs and NIPA hash, GeoFips padded, UNIT_MULT dropped", () => {
    expect(
      rewritten(
        bea,
        `Series.load_api_bea('A', 'Regional', TableName: 'CAINC5N', LineCode: 201, GeoFips: 15007, Year: 'ALL')`,
      ),
    ).toBe(
      `Series.load_from_extract("bea", { dataset: "Regional", table: "CAINC5N", line: "201", geo: "15007", frequency: "A" })`,
    );
    expect(
      rewritten(
        bea,
        `Series.load_api_bea('Q', 'NIPA', { TableName:'T20100', LineNumber:'27' , UNIT_MULT: '9', Frequency:'Q', Year:'ALL' })`,
      ),
    ).toBe(
      `Series.load_from_extract("bea", { dataset: "NIPA", table: "T20100", line: "27", frequency: "Q" })`,
    );
    expect(
      rewritten(
        bea,
        `Series.load_api_bea('A', 'Regional', TableName: 'SAINC1', LineCode: 3, GeoFips: 0, Year: 'ALL')`,
      ),
    ).toContain(`geo: "00000"`);
    expect(
      reason(
        bea,
        `Series.load_api_bea('A', 'Regional', TableName: 'SAINC1', LineCode: 3, GeoFips: 15000, Year: '2020')`,
      ),
    ).toMatch(/Year/);
    expect(
      reason(
        bea,
        `Series.load_api_bea('Q', 'NIPA', TableName: 'T10105', LineNumber: '1', Frequency: 'A', Year: 'ALL')`,
      ),
    ).toMatch(/Frequency/);
  });

  test("eia: AEO annual, STEO monthly", () => {
    expect(
      rewritten(
        eia,
        `Series.load_api_eia_aeo(route: "aeo/2025", scenario: "ref2025", seriesId: "prce_x")`,
      ),
    ).toBe(
      `Series.load_from_extract("eia", { route: "aeo/2025", scenario: "ref2025", series_id: "prce_x", frequency: "A" })`,
    );
    expect(
      rewritten(eia, `Series.load_api_eia_steo(seriesId: "WTIPUUS")`),
    ).toBe(
      `Series.load_from_extract("eia", { route: "steo", series_id: "WTIPUUS", frequency: "M" })`,
    );
    expect(
      reason(eia, `Series.load_api_eia_steo(seriesId: "X", value_in: "other")`),
    ).toMatch(/value_in/);
  });

  test("estatjp: codes copied, missing classes left out", () => {
    expect(
      rewritten(
        estatjp,
        `Series.load_api_estatjp('0003005865', area: '00000', tab: '02', cat02: '01', cat03: '0')`,
      ),
    ).toBe(
      `Series.load_from_extract("estatjp", { stats_data_id: "0003005865", tab: "02", cat02: "01", cat03: "0", area: "00000" })`,
    );
    expect(
      reason(estatjp, `Series.load_api_estatjp('0003005865', time: '2020')`),
    ).toMatch(/time/);
  });

  test("an eval without the legacy call is not converted", () => {
    expect(reason(bls, `"X@US.M".ts * 2`)).toMatch(/no legacy call/);
  });
});
