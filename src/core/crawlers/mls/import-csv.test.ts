import { describe, expect, test } from "bun:test";

import { dedupeCsv, parseCsv } from "./import-csv";

const CSV = `date,mlsNumber,price,sourceUrl
"2025-01","202500001","$500,000","https://example.test/listing/202500001-old-slug/"
"2025-06","202500001","$480,000","./sothebys/single-pages/listing-202500001.html"
"2026-02","202500001","$475,000","https://example.test/listing/202500001-new-slug/"
"2026-02","202500002","--","./sothebys/single-pages/listing-202500002.html"
"2026-02","bogus","$1","https://example.test/x"
"2026-02","202500003","$1,200,000",""
`;

describe("import-csv", () => {
  test("parseCsv handles quoted fields, blank cells and a BOM", () => {
    const rows = parseCsv('﻿a,b\n"x, y","he said ""hi"""\n1,\n');
    expect(rows).toEqual([
      ["﻿a", "b"],
      ["x, y", 'he said "hi"'],
      ["1", ""],
    ]);
  });

  test("dedupeCsv: one entry per number, last URL and last price win, paths ignored", () => {
    const { entries, csvRows } = dedupeCsv(
      parseCsv(CSV),
      "mlsNumber",
      "sourceUrl",
    );
    expect(csvRows).toBe(6);
    expect(entries).toEqual([
      {
        mlsNumber: "202500001",
        url: "https://example.test/listing/202500001-new-slug/",
        listPrice: 475000,
      },
      { mlsNumber: "202500002", url: null, listPrice: null },
      { mlsNumber: "202500003", url: null, listPrice: 1200000 },
    ]);
  });

  test("a later row without a URL keeps the earlier URL", () => {
    const rows = parseCsv(
      "mlsNumber,sourceUrl\n202500009,https://example.test/a/\n202500009,./file.html\n",
    );
    expect(dedupeCsv(rows, "mlsNumber", "sourceUrl").entries[0].url).toBe(
      "https://example.test/a/",
    );
  });

  test("missing MLS column is an error that names the columns", () => {
    expect(() =>
      dedupeCsv(parseCsv("a,b\n1,2\n"), "mlsNumber", "sourceUrl"),
    ).toThrow(/no "mlsNumber" column \(columns: a, b\)/);
  });
});
