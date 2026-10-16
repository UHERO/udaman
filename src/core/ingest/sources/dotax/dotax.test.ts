import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import RawArtifact from "@catalog/models/raw-artifact";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parse as parseHtml } from "node-html-parser";

import type { HttpFetch } from "../../http";
import { fileRawStore, sha256 } from "../../raw-store";
import { runFetch } from "../../run";
import type { RunEnv } from "../../run";
import { MemoryDb } from "../../testing/memory-db";
import type { ParseInput } from "../../types";
import { applyKnown, validate } from "./checks";
import { knownIssues, labelRules } from "./config";
import { archiveCatalog, currentCatalog, periodMonth } from "./fetch-site";
import { dotaxSource } from "./index";
import { fixedLabel } from "./labels";
import { missingPeriods, parseDotaxReports } from "./parse";
import { pickPerMonth, reportType, revRank } from "./parse-files";
import {
  cleanLabel,
  dotaxNum,
  headerMonth,
  matchItem,
  Problems,
} from "./parse-reports";
import type { ParsedRow } from "./parse-reports";

const FIXTURES = join(import.meta.dir, "fixtures");
const CURRENT_FILES = [
  "202507collec.xlsx",
  "202507fuels.xlsx",
  "202507ge.xlsx",
  "202507liab-by-d_ge.xlsx",
  "202507liab-by-d_tat.xlsx",
  "202507liq.xlsx",
  "202507tob.xlsx",
];

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-dotax-"));
  process.env.DATA_DIR = root;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function input(
  key: string,
  file: string,
  downloaderHandle: string,
  id: number,
): ParseInput {
  const path = join(FIXTURES, file);
  return {
    artifact: new RawArtifact({
      id,
      downloader_id: downloaderHandle === "dotax_current" ? 1 : 2,
      artifact_key: key,
      content_hash: sha256(readFileSync(path)),
      storage_path: path,
      original_name: file,
      size: 0,
      metadata: {},
      fetched_at: "2026-10-13 07:22:45",
      last_seen_at: "2026-10-13 07:22:45",
    }),
    path,
    downloaderHandle,
    role: downloaderHandle === "dotax_current" ? "current" : "archive",
  };
}

const fixtureInputs = () => [
  input("2025-06/2025-06.zip", "2025-06.zip", "dotax_archive", 1),
  ...CURRENT_FILES.map((f, i) =>
    input(`2025-07/${f}`, f, "dotax_current", i + 2),
  ),
];

describe("dotax parse (fixtures: 2025-06 archive zip + 2025-07 current files)", () => {
  let result: ReturnType<typeof parseDotaxReports>;
  beforeAll(() => {
    result = parseDotaxReports(fixtureInputs(), () => {});
  });

  test("every report type, both months", () => {
    const types = new Set(result.rows.map((r) => r.dims.type));
    expect([...types].sort()).toEqual([
      "collec",
      "fuels",
      "ge",
      "liab_ge",
      "liab_tat",
      "liq",
      "tob",
    ]);
    const months = new Set(result.rows.map((r) => r.date));
    expect([...months].sort()).toEqual(["2025-06-01", "2025-07-01"]);
  });

  test("checks pass (district sums, totals, labels, coverage)", () => {
    const failed = (result.checks ?? []).filter((c) => !c.passed);
    expect(failed).toEqual([]);
    // two adjacent months: nothing can be missing between them
    expect(result.missing).toEqual([]);
  });

  test("sources print their fixed labels", () => {
    const row = result.rows.find(
      (r) =>
        r.dims.type === "collec" &&
        r.dims.tax === "Income-Ind." &&
        r.dims.source === "Refunds" &&
        r.dims.area === "State",
    );
    expect(row).toBeDefined();
    expect(fixedLabel("collec", "collections", "ind", "ind_refunds")).toBe(
      "Refunds",
    );
  });

  test("one row per (series, month)", () => {
    const seen = new Set<string>();
    for (const r of result.rows) {
      const k = `${Object.values(r.dims).join("|")}|${r.date}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe("dotax fetch (current page)", () => {
  const STATS = "https://tax.hawaii.gov/stats/";
  const CURRENT = "https://tax.hawaii.gov/stats/a1_1monthly/";
  const fileUrl = (f: string) =>
    `https://files.hawaii.gov/tax/stats/monthly/${f}`;
  const statsPage = `<html><body><a href="/stats/a1_1monthly/">Current Monthly Tax Reports</a></body></html>`;
  const currentPage = `<html><body><table>
    <tr><th>July 2025</th></tr>
    <tr><td>General Excise and Use Tax Report</td><td><a href="x.pdf">PDF</a></td><td><a href="${fileUrl("202507ge.xlsx")}">XLSX</a></td></tr>
    <tr><td>Liquor Tax Report (Revised 9/1/25)</td><td><a href="y.pdf">PDF</a></td><td><a href="${fileUrl("202507liq.xlsx")}">XLSX</a></td></tr>
  </table></body></html>`;

  test("stores each listed file under <month>/<file>; past years are final", async () => {
    const requests: string[] = [];
    const http: HttpFetch = async (url) => {
      requests.push(url);
      if (url === STATS) return new Response(statsPage);
      if (url === CURRENT) return new Response(currentPage);
      const f = url.split("/").pop()!;
      if (CURRENT_FILES.includes(f)) {
        return new Response(readFileSync(join(FIXTURES, f)), {
          headers: { "last-modified": "Mon, 01 Sep 2025 10:00:00 GMT" },
        });
      }
      return new Response("missing", { status: 404 });
    };
    const db = new MemoryDb();
    db.addDownloader({
      handle: "dotax_current",
      source_key: "dotax",
      strategy: "custom",
      config: { kind: "current", liveYears: 1 },
    });
    const env: Partial<RunEnv> = {
      db,
      store: fileRawStore(root),
      http,
      sources: { dotax: dotaxSource },
      sleep: async () => {},
    };

    const out = await runFetch("dotax_current", { env, extract: false });
    expect(out.status).toBe("ok");
    expect(db.artifacts.map((a) => [a.artifact_key, Boolean(a.final)])).toEqual(
      [
        ["2025-07/202507ge.xlsx", true],
        ["2025-07/202507liq.xlsx", true],
      ],
    );
    const liq = db.artifacts[1];
    expect(liq.metadata).toEqual({
      lastModified: "2025-09-01T10:00:00.000Z",
      month: "2025-07",
      title: "Liquor Tax Report",
      revisedNote: "(Revised 9/1/25)",
    });

    // final files are not requested again
    requests.length = 0;
    expect(
      (await runFetch("dotax_current", { env, extract: false })).status,
    ).toBe("unchanged");
    expect(requests).toEqual([STATS, CURRENT]);
  });
});

test("the extract of the fixtures is stable", () => {
  const a = parseDotaxReports(fixtureInputs(), () => {});
  const b = parseDotaxReports(fixtureInputs(), () => {});
  expect(a.rows).toEqual(b.rows);
});

// ─── unit tests of the ported R helpers ────────────────────────────

describe("config", () => {
  test("label rules and known issues load", () => {
    expect(labelRules().length).toBeGreaterThan(100);
    // ranges expand to one row per month
    expect(
      knownIssues().filter(
        (k) =>
          k.type === "collec" &&
          k.check === "series_gap" &&
          /surcharge_mau/.test(k.detail),
      ).length,
    ).toBe(72);
  });

  test("every row needs a rule: no catch-all", () => {
    expect(labelRules().some((r) => r.item === "*")).toBe(false);
  });
});

describe("label rules", () => {
  test("cleanLabel strips footnote markers", () => {
    expect(cleanLabel("Fuel 6/")).toBe("Fuel");
    expect(cleanLabel("TOTAL 1/, 7/")).toBe("TOTAL");
    expect(cleanLabel("Tobacco ***")).toBe("Tobacco");
    expect(cleanLabel("* Use (4%)")).toBe("Use (4%)");
    expect(cleanLabel("Use (1/2%)")).toBe("Use (1/2%)");
    expect(cleanLabel("Mtr. Vehicle Tax/Fees, etc.")).toBe(
      "Mtr. Vehicle Tax/Fees, etc.",
    );
  });

  test("headerMonth and dotaxNum", () => {
    expect(headerMonth("MAR 2020*")).toBe("2020-03");
    expect(headerMonth("OCTOBER 2019")).toBe("2019-10");
    expect(headerMonth("FY 2026")).toBeNull();
    expect(dotaxNum("$1,234.50")).toBe(1234.5);
    expect(dotaxNum("")).toBeNull();
    expect(dotaxNum("(12)")).toBeNull();
  });

  test("every spelling resolves to one item; an unknown label resolves to nothing", () => {
    expect(matchItem("Refunds", "collec", "collections", "ind")).toBe(
      "ind_refunds",
    );
    expect(matchItem("Refunds", "collec", "collections", "corp")).toBe(
      "corp_refunds",
    );
    expect(matchItem("Refunds", "collec", "collections", "")).toBeNull();
    expect(matchItem("SUB-TOTAL", "ge", "base")).toBe("subtotal");
    // DOTAX's 2006-01 typo is the same fund
    for (const label of [
      "Domestic Violence/Child Abuse and Neglect Funds",
      "Domestic Viloence/Child Abuse Neglect Funds",
    ]) {
      expect(matchItem(label, "collec", "distribution")).toBe(
        "domestic_violence_fund",
      );
    }
    // a new or misspelled fund is an unknown label, not a new series
    expect(matchItem("Some New Fund", "collec", "distribution")).toBeNull();
    expect(
      matchItem("Cancer Reserch Fund", "collec", "distribution"),
    ).toBeNull();
  });
});

describe("file inventory", () => {
  test("reportType covers DOTAX file-name variants", () => {
    expect(reportType("202508collec.xlsx")).toBe("collec");
    expect(reportType("05collec_rev.xls")).toBe("collec");
    expect(reportType("0812fules.xls")).toBe("fuels");
    expect(reportType("201901liab by ge.xlsx")).toBe("liab_ge");
    expect(reportType("201901tat liab.xlsx")).toBe("liab_tat");
    expect(reportType("201812liqtob.xlsx")).toBe("liqtob");
    expect(reportType("fy2025collec.xlsx")).toBeNull();
    expect(reportType("202508collec.pdf")).toBeNull();
  });

  test("revRank and pickPerMonth", () => {
    expect(revRank("x.xlsx")).toBe(0);
    expect(revRank("x_rev.xlsx")).toBe(1);
    expect(revRank("x_rev3.xlsx")).toBe(3);
    expect(revRank("x_corr.xlsx")).toBe(99);
    const f = (file: string, source: string, fileDate: number) => ({
      type: "collec" as const,
      month: "2018-05",
      file,
      path: `/${source}/${file}`,
      source,
      fileDate,
    });
    // newer source wins over a higher revision marker in an older source
    expect(
      pickPerMonth([
        f("05collec_rev.xls", "a.zip", 1),
        f("05collec.xls", "b.zip", 2),
      ])[0].path,
    ).toBe("/b.zip/05collec.xls");
    // within one source the revision marker wins
    expect(
      pickPerMonth([
        f("05collec.xls", "a.zip", 5),
        f("05collec_rev.xls", "a.zip", 1),
      ])[0].file,
    ).toBe("05collec_rev.xls");
  });
});

describe("report pages", () => {
  test("periodMonth", () => {
    expect(periodMonth("August 2026")).toBe("2026-08");
    expect(periodMonth("FY 2026")).toBeNull();
  });

  test("currentCatalog takes the month from the table header and the title from the preceding cell", () => {
    const html = `
      <table><tr><th>August 2026</th></tr>
        <tr><td>State Tax Collections and Distribution (Revised 06-10-2026)</td>
            <td><a href="https://files.hawaii.gov/tax/stats/monthly/202608collec.pdf">PDF</a></td>
            <td><a href="https://files.hawaii.gov/tax/stats/monthly/202608collec.xlsx">XLSX</a></td></tr>
        <td>Liquid Fuel Tax</td><td><a href="https://files.hawaii.gov/tax/stats/monthly/202608fuels.xlsx">XLSX</a></td>
      </table>
      <table><tr><th>FY 2026</th></tr>
        <tr><td>Summary</td><td><a href="https://files.hawaii.gov/tax/stats/monthly/fy2026.xlsx">XLSX</a></td></tr>
      </table>`;
    expect(currentCatalog(parseHtml(html))).toEqual([
      {
        url: "https://files.hawaii.gov/tax/stats/monthly/202608collec.xlsx",
        month: "2026-08",
        title: "State Tax Collections and Distribution",
        revisedNote: "(Revised 06-10-2026)",
      },
      {
        url: "https://files.hawaii.gov/tax/stats/monthly/202608fuels.xlsx",
        month: "2026-08",
        title: "Liquid Fuel Tax",
        revisedNote: "",
      },
    ]);
  });

  test("archiveCatalog prefers the zip name's month", () => {
    const html = `<table>
      <tr><td>November 2002</td><td><a href="/stats/archive/2002-10.zip">zip</a></td></tr>
      <tr><td>December 2001</td><td><a href="/stats/archive/2001-12.zip">zip</a></td></tr>
      <tr><td>FY 2003</td><td><a href="/stats/archive/fy2003.zip">zip</a></td></tr>
    </table>`;
    expect(archiveCatalog(parseHtml(html), "2002-01")).toEqual([
      {
        url: "https://tax.hawaii.gov/stats/archive/2002-10.zip",
        month: "2002-10",
      },
    ]);
  });
});

const row = (r: Partial<ParsedRow>): ParsedRow => ({
  type: "collec",
  month: "2010-01",
  file: "f.xls",
  section: "collections",
  sub: "",
  label: "",
  item: "x",
  geo: "HI",
  value: 0,
  row: 1,
  ...r,
});

describe("checks", () => {
  test("district_sum flags districts that don't add up to the state", () => {
    const problems = new Problems();
    validate(
      [
        row({ item: "fuel", geo: "HI", value: 100 }),
        row({ item: "fuel", geo: "HON", value: 60 }),
        row({ item: "fuel", geo: "MAU", value: 30 }),
      ],
      problems,
    );
    expect(
      problems.list.find((p) => p.check === "district_sum")?.detail,
    ).toContain("90.00 vs 100.00");
  });

  test("known issues waive matching problems and carry their note", () => {
    const { open, waived } = applyKnown([
      {
        type: "collec",
        month: "2009-07",
        check: "blank_label",
        detail: "row 40 has values: 480983",
        file: "",
      },
      {
        type: "collec",
        month: "2009-08",
        check: "blank_label",
        detail: "row 40 has values: 480983",
        file: "",
      },
    ]);
    expect(waived.length).toBe(1);
    expect(waived[0].note).toMatch(/no label/);
    expect(open[0].month).toBe("2009-08");
  });
});

describe("missing periods", () => {
  const dims = { type: "collec", tax: "X", source: "X", area: "State" };
  const months = [
    "2021-06",
    "2021-07",
    "2021-08",
    "2021-09",
    "2021-10",
    "2021-11",
  ];

  test("blank, absent (with the known-issue note) and failed are told apart", () => {
    const k = "collec|distribution||natural_area_reserve_fund|HI";
    const r = (month: string, value: number | null) =>
      row({
        section: "distribution",
        item: "natural_area_reserve_fund",
        month,
        value,
      });
    const out = missingPeriods(
      [r("2021-06", 5), r("2021-07", null), r("2021-11", 0)],
      new Map([[k, dims]]),
      new Map([["collec", months]]),
      new Map([
        ["collec|2021-10", "unreadable: file cannot be opened (waived: …)"],
      ]),
    );
    expect(out.map((m) => [m.date, m.reason])).toEqual([
      ["2021-07-01", "blank"],
      ["2021-08-01", "absent"],
      ["2021-09-01", "absent"],
      ["2021-10-01", "failed"],
    ]);
    // 2021-08/09 fall in the known issue "fund ended; DOTAX dropped the row"
    expect(out[1].detail).toMatch(/fund ended/);
    expect(out[3].detail).toMatch(/unreadable/);
  });

  test("nothing before the first or after the last value", () => {
    const k = "collec|collections||fuel|HI";
    const out = missingPeriods(
      [row({ item: "fuel", month: "2021-08", value: 1 })],
      new Map([[k, dims]]),
      new Map([["collec", months]]),
      new Map(),
    );
    expect(out).toEqual([]);
  });
});
