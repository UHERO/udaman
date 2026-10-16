import { describe, expect, test } from "bun:test";

import { cellMonth, parseSheetValues } from "./parse";

describe("dotax_sheet parse", () => {
  test("cellMonth", () => {
    expect(cellMonth(45839)).toBe("2025-07-01"); // 2025-07-01 serial
    expect(cellMonth("2025-07-15")).toBe("2025-07-01");
    expect(cellMonth("2025-13")).toBeNull();
    expect(cellMonth("July 2025")).toBeNull();
  });

  test("finds columns by header and prints the latest spelling", () => {
    const { rows, checks } = parseSheetValues([
      [
        "Fiscal Year",
        "Date (yyyy-mm-dd)",
        "Source Type",
        "Tax Type",
        "Source",
        "Amount",
      ],
      [
        2025,
        "2025-06-01",
        "Collection",
        "General Excise",
        "General Excise and Use",
        100,
      ],
      [
        2026,
        45839,
        "Collection",
        "General Excise",
        "General  excise and use",
        "1,200",
      ],
      [
        2026,
        "2025-08-01",
        "Collection",
        "General Excise",
        "General Excise and Use",
        "",
      ],
      ["", "", "", "", "", ""],
    ]);
    expect(checks.every((c) => c.passed)).toBe(true);
    expect(rows).toEqual([
      {
        dims: {
          type: "Collection",
          tax: "General Excise",
          source: "General  excise and use",
        },
        date: "2025-06-01",
        value: 100,
      },
      {
        dims: {
          type: "Collection",
          tax: "General Excise",
          source: "General  excise and use",
        },
        date: "2025-07-01",
        value: 1200,
      },
    ]);
  });

  test("two amounts for one month is a hard failure; a bad date throws", () => {
    const header = ["date", "type", "tax", "source", "amount"];
    const { checks } = parseSheetValues([
      header,
      ["2025-06-01", "Collection", "Fuel", "Fuel", 1],
      ["2025-06-01", "Collection", "Fuel", "Fuel", 2],
    ]);
    expect(checks.find((c) => !c.passed)?.check).toBe("sheet:conflicts");
    expect(() =>
      parseSheetValues([header, ["June", "Collection", "Fuel", "Fuel", 1]]),
    ).toThrow(/row\(s\) 2/);
  });
});
