import EvalParser from "@catalog/utils/eval-parser";
import { describe, expect, mock, test } from "bun:test";

import { blsApi } from "./bls-api";
import {
  DOTAX_LAYOUT,
  dotaxDisplay,
  dotaxIndexKey,
  dotaxKeyFromArgs,
} from "./dotax/args";
import { dotaxSheet } from "./dotax/sheet";
import { findCalls, resolveRefs } from "./keys";
import { applyWrite, DEFAULT_LAYOUT, parseTidy, serializeTidy } from "./tidy";
import type { TidyRow } from "./types";

describe("tidy", () => {
  const rows: TidyRow[] = [
    { key: "B", date: "2024-02-01", value: 2, freq: "M" },
    { key: "A", date: "2024-01-01", value: 1.5 },
    { key: 'q"uote,d', date: "2024-01-01", value: -3 },
  ];

  test("serialize is sorted and round-trips", () => {
    const text = serializeTidy(rows);
    expect(text.split("\n")[0]).toBe("key,date,value,freq");
    expect(text.split("\n")[1]).toBe("A,2024-01-01,1.5,");
    expect(parseTidy(text)).toEqual([
      { key: "A", date: "2024-01-01", value: 1.5 },
      { key: "B", date: "2024-02-01", value: 2, freq: "M" },
      { key: 'q"uote,d', date: "2024-01-01", value: -3 },
    ]);
    expect(serializeTidy([...rows].reverse())).toBe(text);
  });

  test("a layout writes the key parts as their own columns", () => {
    const flat: TidyRow[] = [
      {
        key: "collec|Income-Ind.|Refunds|State",
        date: "2025-12-01",
        value: -8920005,
        extra: { fiscal_year: "2026" },
      },
      {
        key: "ge|Base|Theater, Amuse., Radio, etc.|Maui",
        date: "2025-12-01",
        value: 5,
        extra: { fiscal_year: "2026" },
      },
    ];
    const text = serializeTidy(flat, DOTAX_LAYOUT);
    expect(text).toBe(
      [
        "date,type,tax,source,area,amount,fiscal_year",
        "2025-12-01,collec,Income-Ind.,Refunds,State,-8920005,2026",
        '2025-12-01,ge,Base,"Theater, Amuse., Radio, etc.",Maui,5,2026',
        "",
      ].join("\n"),
    );
    expect(parseTidy(text, DOTAX_LAYOUT)).toEqual(flat);
    // a file in another layout reads as empty rather than as garbage
    expect(parseTidy(text, DEFAULT_LAYOUT)).toEqual([]);
    expect(() =>
      serializeTidy(
        [{ key: "a|b", date: "2025-01-01", value: 1 }],
        DOTAX_LAYOUT,
      ),
    ).toThrow(/4 part/);
  });

  test("replace drops everything else", () => {
    expect(applyWrite(rows, { mode: "replace", rows: [rows[0]] })).toEqual([
      rows[0],
    ]);
  });

  test("merge keeps other keys and rows before replaceFrom", () => {
    const prev: TidyRow[] = [
      { key: "X", date: "1990-01-01", value: 1 },
      { key: "X", date: "2010-01-01", value: 2 },
      { key: "Y", date: "2010-01-01", value: 3 },
      { key: "Z", date: "2010-01-01", value: 4 },
    ];
    const out = applyWrite(prev, {
      mode: "merge",
      rows: [
        { key: "X", date: "2010-01-01", value: 20 },
        { key: "Y", date: "2011-01-01", value: 30 },
      ],
      replaceFrom: { X: "2007-01-01" },
    });
    expect(out).toEqual([
      { key: "X", date: "1990-01-01", value: 1 },
      { key: "Z", date: "2010-01-01", value: 4 },
      { key: "X", date: "2010-01-01", value: 20 },
      { key: "Y", date: "2011-01-01", value: 30 },
    ]);
  });
});

describe("keys", () => {
  test("finds load-method calls inside arithmetic and chains", () => {
    const ast = EvalParser.parse(
      'Series.load_from_bls_api("CUSR0000SA0", "M") * 1000',
    );
    expect(findCalls(ast, "load_from_bls_api")).toEqual([["CUSR0000SA0", "M"]]);
    const chained = EvalParser.parse(
      'Series.load_from_dotax_current("ge", "Base", "SUB-TOTAL 2", "Maui").trim("2002-01-01", "2020-02-01")',
    );
    expect(findCalls(chained, "load_from_dotax_current")).toEqual([
      ["ge", "Base", "SUB-TOTAL 2", "Maui"],
    ]);
  });

  test("resolveRefs reports bad arguments per loader", () => {
    const base = {
      seriesId: 1,
      seriesName: "X@HI.M",
      universe: "UHERO",
      disabled: false,
    };
    const out = resolveRefs(blsApi, [
      {
        ...base,
        loaderId: 1,
        eval: 'Series.load_from_bls_api "lns12000000", "M"',
      },
      { ...base, loaderId: 2, eval: 'Series.load_from_bls_api "bad id!", "M"' },
    ]);
    expect(out[0].keys.map((k) => k.key)).toEqual(["LNS12000000"]);
    expect(out[0].error).toBeNull();
    expect(out[1].keys).toEqual([]);
    expect(out[1].error).toContain("not a BLS series ID");
  });
});

describe("bls_api args", () => {
  test("uppercases the id and checks the frequency", () => {
    expect(blsApi.keyFromArgs(["cusr0000sa0", "m"])).toMatchObject({
      key: "CUSR0000SA0",
      frequency: "M",
    });
    expect(() => blsApi.keyFromArgs(["CUSR0000SA0", "monthly"])).toThrow();
  });
});

describe("dotax args", () => {
  const key = (...a: string[]) =>
    dotaxKeyFromArgs("load_from_dotax_current", a).key;

  test("a row with no heading is its own tax; any DOTAX spelling resolves", () => {
    const a = key(
      "collec",
      "General Excise & Use",
      "General Excise & Use",
      "State",
    );
    expect(a).toBe("collec|collections||general_excise|HI");
    expect(
      key("collec", "General Excise and Use", "General Excise and Use"),
    ).toBe(a);
    expect(
      key(
        "collec",
        "Source of Revenue",
        "General Excise & Use",
        "All Districts",
      ),
    ).toBe(a);
  });

  test("headings, totals, districts", () => {
    expect(key("collec", "Income-Ind.", "Refunds", "Third District")).toBe(
      "collec|collections|ind|ind_refunds|HAW",
    );
    expect(key("collec", "Income-Corp", "Payment W/Returns")).toBe(
      "collec|collections|corp|corp_pay_returns|HI",
    );
    expect(key("collec", "Source of Revenue", "TOTAL", "State")).toBe(
      "collec|coll_total||total|HI",
    );
    expect(key("collec", "TOTAL", "TOTAL")).toBe(
      "collec|grand_total||grand_total|HI",
    );
    expect(
      key("collec", "Distribution of Collections", "State General Fund"),
    ).toBe("collec|distribution||general_fund|HI");
    expect(key("collec", "County Surcharges", "County of Maui")).toBe(
      "collec|county_surcharge||surcharge_mau|HI",
    );
    expect(key("collec", "County Surcharges", "TOTAL")).toBe(
      "collec|county_surcharge||county_surcharges|HI",
    );
    // the collections row of the same name is its own tax
    expect(key("collec", "County Surcharges", "County Surcharges")).toBe(
      "collec|collections||county_surcharge|HI",
    );
  });

  test("activity and fuels taxes, numbered subtotals", () => {
    expect(key("ge", "Base", "Retailing", "Maui")).toBe(
      "ge|base||retailing|MAU",
    );
    expect(key("ge", "Collections", "SUB-TOTAL 2", "Oahu")).toBe(
      "ge|collections||subtotal2|HON",
    );
    expect(key("liab_ge", "Liability", "Retailing", "Unknown")).toBe(
      "liab_ge|liability||retailing|UNK",
    );
    expect(key("fuels", "Total Tax", "TOTAL", "Kauai")).toBe(
      "fuels|base_total||total|KAU",
    );
    expect(
      key("fuels", "Allocation Amount", "County Fuel Tax", "C&C of Honolulu"),
    ).toBe("fuels|alloc_amount||county_fuel_tax|HON");
    expect(key("liq", "Liquor", "TOTAL COLLECTIONS", "Maui")).toBe(
      "liq|liquor||total|MAU",
    );
  });

  test("printed columns resolve back to the same key", () => {
    const cases: Array<[Parameters<typeof dotaxDisplay>[0], string, string]> = [
      [
        {
          type: "collec",
          section: "collections",
          sub: "",
          item: "conveyance",
          geo: "HI",
        },
        "Conveyance",
        "collec|Conveyance|Conveyance|State",
      ],
      [
        {
          type: "collec",
          section: "collections",
          sub: "ind",
          item: "ind_refunds",
          geo: "HI",
        },
        "Refunds",
        "collec|Income-Ind.|Refunds|State",
      ],
      [
        {
          type: "collec",
          section: "coll_total",
          sub: "",
          item: "total",
          geo: "HI",
        },
        "TOTAL - DECEMBER",
        "collec|Source of Revenue|TOTAL|State",
      ],
      [
        {
          type: "collec",
          section: "grand_total",
          sub: "",
          item: "grand_total",
          geo: "HI",
        },
        "TOTAL",
        "collec|TOTAL|TOTAL|State",
      ],
      [
        {
          type: "collec",
          section: "county_surcharge",
          sub: "",
          item: "county_surcharges",
          geo: "HI",
        },
        "COUNTY SURCHARGES",
        "collec|County Surcharges|TOTAL|State",
      ],
      [
        {
          type: "ge",
          section: "collections",
          sub: "",
          item: "subtotal2",
          geo: "KAU",
        },
        "SUB-TOTAL",
        "ge|Collections|SUB-TOTAL 2|Kauai",
      ],
      [
        {
          type: "fuels",
          section: "alloc_amount",
          sub: "",
          item: "county_fuel_tax_maui",
          geo: "MAU",
        },
        "Island of Maui",
        "fuels|Allocation Amount|Island of Maui|Maui",
      ],
    ];
    for (const [r, label, rowKey] of cases) {
      const d = dotaxDisplay(r, label);
      expect([r.type, d.tax, d.source, d.area].join("|")).toBe(rowKey);
      expect(dotaxIndexKey(rowKey)).toBe(
        `${r.type}|${r.section}|${r.sub}|${r.item}|${r.geo}`,
      );
    }
  });

  test("helpful errors", () => {
    expect(() => key("collec", "Nope", "Fuel", "State")).toThrow(
      /unknown collec tax/,
    );
    expect(() => key("collec", "Fuel", "Fuel", "Molokai")).toThrow(
      /unknown area/,
    );
    expect(() =>
      key("ge", "Base", "Underwater Basket Weaving", "State"),
    ).toThrow(/not recognized/);
    expect(() => key("collec", "Income-Corp.", "Income-Corp.")).toThrow(
      /heading/,
    );
    expect(() => key("collec", "Fuel")).toThrow(/expects type, tax, source/);
  });
});

describe("dotax_sheet args", () => {
  test("normalizes case and whitespace; State only", () => {
    const k = dotaxSheet.keyFromArgs([
      "Collection",
      "General Excise",
      "General  Excise & Use",
    ]).key;
    expect(k).toBe("collection|general excise|general excise & use|HI");
    expect(
      dotaxSheet.indexKey!(
        "Collection|General Excise|General Excise & Use|State",
      ),
    ).toBe(k);
    expect(() =>
      dotaxSheet.keyFromArgs(["Collection", "x", "y", "Maui"]),
    ).toThrow(/statewide/);
    expect(() => dotaxSheet.keyFromArgs(["Collection", "x"])).toThrow();
  });
});

describe("dotax_sheet run", () => {
  const ctxFor = () =>
    ({
      downloader: {
        configValue: (k: string, d: unknown) =>
          k === "sheetId" ? "test-sheet" : d,
      },
      log: () => {},
    }) as unknown as Parameters<typeof dotaxSheet.run>[0];

  test("reads the new headers, text or real dates, and writes the flat shape", async () => {
    mock.module("./google-sheets", () => ({
      fetchSheetValues: async () => [
        ["date (yyyy-mm-dd)", "type", "tax", "source", "amount", "fiscal year"],
        [
          "2025-09-01",
          "Collection",
          "General Excise",
          "General Excise & Use",
          300,
          2026,
        ],
        // 45931 = 2025-10-01 as a Sheets serial date
        [
          45931,
          "Collection",
          "General Excise",
          "General Excise & Use",
          "1,234.5",
          2026,
        ],
        [
          "2025-11-01",
          "Collection",
          "General Excise",
          "General Excise & Use",
          "",
          2026,
        ],
        [
          "2025-09-01",
          "Distribution",
          "County Surcharge",
          "County of Maui",
          7,
          "",
        ],
        [
          "2025-09-01",
          "Distribution",
          "County Surcharge",
          "County of Maui",
          8,
          "",
        ],
        [],
      ],
    }));
    const out = await dotaxSheet.run(ctxFor());
    expect(out.write).toEqual({
      mode: "replace",
      rows: [
        {
          key: "Collection|General Excise|General Excise & Use|State",
          date: "2025-09-01",
          value: 300,
          extra: { fiscal_year: "2026" },
        },
        {
          key: "Collection|General Excise|General Excise & Use|State",
          date: "2025-10-01",
          value: 1234.5,
          extra: { fiscal_year: "2026" },
        },
      ],
    });
    expect(out.failedKeys).toEqual([
      "duplicate observations: distribution|county surcharge|county of maui|HI",
    ]);
  });

  test("the original headers still work; text dates must be yyyy-mm-dd", async () => {
    mock.module("./google-sheets", () => ({
      fetchSheetValues: async () => [
        ["Date", "Source Type", "Tax Type", "Source", "Amount", "Fiscal Year"],
        ["9/1/2025", "Collection", "x", "y", 1, 2026],
      ],
    }));
    await expect(dotaxSheet.run(ctxFor())).rejects.toThrow(/row\(s\) 2/);
  });
});
