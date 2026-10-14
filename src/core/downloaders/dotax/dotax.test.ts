import { describe, expect, test } from "bun:test";
import { parse } from "node-html-parser";

import {
  applyKnown,
  checkGaps,
  fillLegacy,
  mapSeries,
  validate,
} from "./checks";
import { knownIssues, labelRules } from "./config";
import {
  cleanLabel,
  dotaxNum,
  headerMonth,
  matchItem,
  Problems,
} from "./parse";
import type { ParsedRow } from "./parse";
import { parseSourceHandle, sourceHandle } from "./report";
import {
  archiveCatalog,
  currentCatalog,
  periodMonth,
  pickPerMonth,
  reportType,
  revRank,
} from "./site";

describe("config", () => {
  test("label rules and known issues load from the R CSVs", () => {
    expect(labelRules().length).toBeGreaterThan(100);
    // ranges expand to one row per month
    expect(
      knownIssues().filter(
        (k) =>
          k.type === "collec" &&
          k.check === "series_gap" &&
          /MAU/.test(k.detail),
      ).length,
    ).toBe(72);
  });
});

describe("parse helpers", () => {
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

  test("headerMonth", () => {
    expect(headerMonth("MAR 2020*")).toBe("2020-03");
    expect(headerMonth("OCTOBER 2019")).toBe("2019-10");
    expect(headerMonth("Jun 2026")).toBe("2026-06");
    expect(headerMonth("FY 2026")).toBeNull();
  });

  test("dotaxNum mirrors as.numeric after stripping , $ and spaces", () => {
    expect(dotaxNum("$1,234.50")).toBe(1234.5);
    expect(dotaxNum("-12")).toBe(-12);
    expect(dotaxNum("")).toBeNull();
    expect(dotaxNum("(12)")).toBeNull();
  });

  test("matchItem: first matching rule wins, '*' rules slug the label", () => {
    expect(matchItem("Refunds", "collec", "collections", "ind")).toBe(
      "ind_refunds",
    );
    expect(matchItem("Refunds", "collec", "collections", "corp")).toBe(
      "corp_refunds",
    );
    expect(matchItem("Refunds", "collec", "collections", "")).toBeNull();
    expect(matchItem("Some New Fund", "collec", "distribution")).toBe(
      "some_new_fund",
    );
    expect(matchItem("SUB-TOTAL", "ge", "base")).toBe("subtotal");
  });
});

describe("site", () => {
  test("reportType covers DOTAX file-name variants", () => {
    expect(reportType("202508collec.xlsx")).toBe("collec");
    expect(reportType("05collec_rev.xls")).toBe("collec");
    expect(reportType("0812fules.xls")).toBe("fuels");
    expect(reportType("201901liab by ge.xlsx")).toBe("liab_ge");
    expect(reportType("201901tat liab.xlsx")).toBe("liab_tat");
    expect(reportType("201812liqtob.xlsx")).toBe("liqtob");
    expect(reportType("202001liq.xlsx")).toBe("liq");
    expect(reportType("202508ge.xlsx")).toBe("ge");
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
    expect(currentCatalog(parse(html))).toEqual([
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
    expect(archiveCatalog(parse(html), "2002-01")).toEqual([
      {
        url: "https://tax.hawaii.gov/stats/archive/2002-10.zip",
        month: "2002-10",
      },
    ]);
  });

  test("source handles round-trip", () => {
    const h = sourceHandle("CUR", "2025-08", "202508collec_rev.xlsx");
    expect(h).toBe("DOTAX_CUR_2025-08_202508collec_rev@tax.hawaii.gov");
    expect(parseSourceHandle(h)).toEqual({
      kind: "CUR",
      month: "2025-08",
      stem: "202508collec_rev",
    });
    expect(sourceHandle("ARC", "2002-05", "2002 05%.zip")).not.toContain("%");
  });
});

describe("checks", () => {
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

  test("gap check uses mapped ids and the legacy fills", () => {
    const problems = new Problems();
    const parsed = [
      row({
        type: "ge",
        section: "collections",
        item: "interest_all_others",
        month: "2016-02",
        value: 5,
      }),
      row({
        type: "ge",
        section: "collections",
        item: "interest",
        month: "2016-03",
        value: 2,
      }),
      row({
        type: "ge",
        section: "collections",
        item: "all_others_4",
        month: "2016-03",
        value: 1,
      }),
      row({
        type: "ge",
        section: "collections",
        item: "interest_all_others",
        month: "2016-04",
        value: 5,
      }),
    ];
    const mapped = fillLegacy(mapSeries(parsed, problems));
    // ITO in 2016-03 is filled with IT + OT, so no gap
    expect(
      mapped.find((m) => m.id === "TGRITONS@HI.M" && m.month === "2016-03")
        ?.value,
    ).toBe(3);
    checkGaps(
      mapped,
      ["2016-02", "2016-03", "2016-04"].map((month) => ({ type: "ge", month })),
      problems,
    );
    expect(problems.list.filter((p) => /ITONS/.test(p.detail))).toEqual([]);
  });

  test("known issues waive matching problems", () => {
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
    expect(open[0].month).toBe("2009-08");
  });
});
