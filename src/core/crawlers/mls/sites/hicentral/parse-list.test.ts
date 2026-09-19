import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { MlsParseError } from "../../types";
import { parseList } from "./parse-list";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "fixtures", name), "utf8");

describe("hicentral parseList", () => {
  test("active page: 20 deduped rows in page order, with total", () => {
    const r = parseList(fixture("list-oahu-active-p1.html"));
    expect(r.totalCount).toBe(3630);
    expect(r.rows).toHaveLength(20);
    expect(r.rows.map((x) => x.mlsNumber)).toEqual([
      "202617816",
      "202617803",
      "202617800",
      "202617796",
      "202617795",
      "202617792",
      "202617783",
      "202617782",
      "202617765",
      "202617749",
      "202617747",
      "202617723",
      "202617679",
      "202617670",
      "202617644",
      "202617625",
      "202617612",
      "202617598",
      "202617583",
      "202617573",
    ]);
    expect(r.rows[0]).toEqual({
      mlsNumber: "202617816",
      status: "active",
      listPrice: 775000,
    });
    expect(r.rows[1]).toEqual({
      mlsNumber: "202617803",
      status: "active",
      listPrice: 402730,
    });
    expect(r.rows.every((x) => x.status === "active")).toBe(true);
    expect(r.rows.every((x) => /^\d{9}$/.test(x.mlsNumber))).toBe(true);
  });

  test("sold page: status sold, and the row's (sold) price is not reported as a list price", () => {
    const r = parseList(fixture("list-oahu-sold-p1.html"));
    expect(r.totalCount).toBe(15962);
    expect(r.rows).toHaveLength(20);
    expect(r.rows[0]).toEqual({
      mlsNumber: "202615741",
      status: "sold",
      listPrice: null,
    });
    expect(r.rows.every((x) => x.status === "sold")).toBe(true);
    expect(r.rows.every((x) => x.listPrice === null)).toBe(true);
  });

  test("mixed-status page (P-Active / P-InEscrow / P-Sold rows)", () => {
    const r = parseList(fixture("list-oahu-any-p499.html"));
    expect(r.totalCount).toBe(20629);
    expect(r.rows).toHaveLength(20);
    expect(r.rows.filter((x) => x.status !== "sold")).toEqual([
      { mlsNumber: "202528488", status: "active", listPrice: 320000 },
      { mlsNumber: "202528459", status: "active", listPrice: 137500 },
      { mlsNumber: "202528454", status: "active", listPrice: 174900 },
      { mlsNumber: "202528439", status: "active", listPrice: 699000 },
      { mlsNumber: "202528345", status: "pending", listPrice: 21000000 },
      { mlsNumber: "202528027", status: "active", listPrice: 7300000 },
    ]);
    expect(r.rows.filter((x) => x.status === "sold")).toHaveLength(14);
  });

  test("short page: fewer than 20 rows", () => {
    const r = parseList(fixture("list-lanai-any-p1.html"));
    expect(r).toEqual({
      totalCount: 5,
      rows: [
        { mlsNumber: "202506288", status: "sold", listPrice: null },
        { mlsNumber: "202613156", status: "active", listPrice: 1450000 },
        { mlsNumber: "202506279", status: "sold", listPrice: null },
        { mlsNumber: "202526426", status: "sold", listPrice: null },
        { mlsNumber: "202506307", status: "sold", listPrice: null },
      ],
    });
  });

  test("page past the end: no rows, counter still read, no throw", () => {
    const r = parseList(fixture("list-lanai-any-p2-empty.html"));
    expect(r).toEqual({ rows: [], totalCount: 5 });
  });

  test("a page that is not a results page throws MlsParseError", () => {
    expect(() => parseList(fixture("detail-not-found-999999999.html"))).toThrow(
      MlsParseError,
    );
    expect(() =>
      parseList("<html><body>Service Unavailable</body></html>"),
    ).toThrow(MlsParseError);
    expect(() => parseList("")).toThrow(MlsParseError);
  });

  test("rows without a counter still parse (totalCount null)", () => {
    const html = `<ul class="P-Results"><li class="P-Active">
      <a href="?/202600001"><img /></a>
      <div class="P-Results1"><span><a href="?/202600001">202600001</a></span>
        <a href="?/Results/Address///1///Kakala//">Kakala St</a></div>
      <div class="P-Results2"><div class="P-Active">$1,234,567 (LH)</div></div>
      <div class="P-Results3 P-Active"><span>Active Under Contract</span></div>
    </li></ul>`;
    expect(parseList(html)).toEqual({
      totalCount: null,
      rows: [
        {
          mlsNumber: "202600001",
          status: "active_under_contract",
          listPrice: 1234567,
        },
      ],
    });
  });
});
