import { describe, expect, test } from "bun:test";

import { fingerprintOf } from "./issue-store";
import {
  agentEvalRefusal,
  errorSignature,
  isLagError,
  lagGroupKey,
  metadataChangeType,
  stateMatches,
} from "./rules";

describe("errorSignature", () => {
  test("groups the same failure across years and files", () => {
    const a = errorSignature(
      "404 Not Found: https://dbedt.hawaii.gov/visitor/mvs_2025.xlsx",
    );
    const b = errorSignature(
      "404 Not Found: https://dbedt.hawaii.gov/visitor/mvs_2026_jan.xlsx",
    );
    expect(a).toBe(b);
    expect(a).toContain("url(dbedt.hawaii.gov)");
  });

  test("keeps different hosts apart", () => {
    expect(errorSignature("timeout https://api.bls.gov/x")).not.toBe(
      errorSignature("timeout https://apps.bea.gov/x"),
    );
  });

  test("collapses quoted values and numbers", () => {
    expect(errorSignature(`header "Hawaii Island" not found in row 12`)).toBe(
      errorSignature(`header "Maui" not found in row 7`),
    );
  });
});

describe("stateMatches (proposal stale check)", () => {
  test("ignores keys not in before", () => {
    expect(stateMatches({ eval: "x", priority: 100 }, { eval: "x" })).toBe(
      true,
    );
  });
  test("null, undefined and empty string are equal", () => {
    expect(stateMatches({ source_id: null }, { source_id: "" })).toBe(true);
    expect(stateMatches({}, { source_link: null })).toBe(true);
  });
  test("number vs string compare by value", () => {
    expect(stateMatches({ unit_id: 12 }, { unit_id: "12" })).toBe(true);
  });
  test("an edit since proposing is stale", () => {
    expect(stateMatches({ eval: "new" }, { eval: "old" })).toBe(false);
  });
});

describe("metadataChangeType", () => {
  test("the basis picks the autonomy setting", () => {
    expect(metadataChangeType("measurement_series")).toBe(
      "fill_measurement_from_series",
    );
    expect(metadataChangeType("research")).toBe("fill_metadata_from_research");
    // No basis given: the cautious type.
    expect(metadataChangeType()).toBe("fill_metadata_from_research");
  });
});

describe("isLagError", () => {
  test("matches both lag messages, not real errors", () => {
    expect(
      isLagError(
        "Lag limit exceeded: last data point 2026-08-01 is 80d behind (limit 60d)",
      ),
    ).toBe(true);
    expect(
      isLagError("Lag limit (45d) exceeded: loader has no data points"),
    ).toBe(true);
    expect(isLagError("ENOENT: no such file or directory")).toBe(false);
    expect(isLagError(null)).toBe(false);
  });
});

describe("lagGroupKey", () => {
  test("loaders reading the same file are one group", () => {
    const a = lagGroupKey(
      '"UNNS@HI.Q".tsn.load_from "rparsed/bls_quarterly.csv"',
      "UNNS@HI.Q",
    );
    const b = lagGroupKey(
      '"UNLNS@HI.Q".tsn.load_from "rparsed/bls_quarterly.csv"',
      "UNLNS@HI.Q",
    );
    expect(a).toBe(b);
    expect(a).toBe("loader_lag:file:rparsed/bls_quarterly.csv");
  });
  test("API loaders group by source and prefix", () => {
    expect(lagGroupKey('Series.load_api_bls("SMU15", "M")', "E_NF@HI.M")).toBe(
      "loader_lag:api_bls:E_NF",
    );
    expect(lagGroupKey('"A@HI.M".ts * 2', "B@HI.M")).toBe("loader_lag:B");
  });
});

describe("agentEvalRefusal (load statements the agent supplies)", () => {
  test("allows files inside the data directory", () => {
    expect(
      agentEvalRefusal(
        'Series.load_from_file("rawdata/Manual/dom_prud.xls", {:file_type=>"xls"})',
      ),
    ).toBeNull();
    expect(
      agentEvalRefusal('Series.load_from_file("rparsed/qser.csv", {})'),
    ).toBeNull();
    expect(
      agentEvalRefusal('"UNNS@HI.Q".tsn.load_from "rparsed/bls_quarterly.csv"'),
    ).toBeNull();
  });
  test("leaves download handles and extracts alone", () => {
    expect(
      agentEvalRefusal(
        'Series.load_from_download("handle@bls.gov", {:file_type=>"xls"})',
      ),
    ).toBeNull();
    expect(
      agentEvalRefusal('Series.load_from_extract("bls", { series_id: "X" })'),
    ).toBeNull();
  });
  test("allows statements that read no file", () => {
    expect(agentEvalRefusal('Series.load_api_bls("SMU15", "M")')).toBeNull();
    expect(agentEvalRefusal('"VIS@HI.M".ts * 1000')).toBeNull();
  });
  test("refuses paths that leave the data directory", () => {
    expect(
      agentEvalRefusal('Series.load_from_file("../../etc/passwd", {})'),
    ).toContain("relative");
    expect(
      agentEvalRefusal('Series.load_from_file("/etc/passwd", {})'),
    ).toContain("relative");
    expect(
      agentEvalRefusal('Series.load_from_file("rawdata/../../x.csv", {})'),
    ).toContain("relative");
    expect(agentEvalRefusal('"A@HI.Q".tsn.load_from "/etc/passwd"')).toContain(
      "relative",
    );
  });
  test("refuses a path that isn't a plain quoted string", () => {
    expect(agentEvalRefusal("Series.load_from_file(path, {})")).toContain(
      "literal",
    );
    expect(
      agentEvalRefusal(
        'Series.load_from_file("rawdata/a.csv", {}) + Series.load_from_file(x, {})',
      ),
    ).toContain("literal");
  });
});

describe("fingerprintOf", () => {
  test("includes universe, kind, subject and field", () => {
    expect(
      fingerprintOf({
        universe: "UHERO",
        kind: "missing_metadata",
        subjectType: "measurement",
        subjectId: 5,
        subjectField: "unit_id",
      }),
    ).toBe("UHERO:missing_metadata:measurement:5:unit_id");
    expect(
      fingerprintOf({
        universe: "UHERO",
        kind: "load_error",
        subjectType: "loader",
        subjectId: 9,
      }),
    ).toBe("UHERO:load_error:loader:9");
  });
});
