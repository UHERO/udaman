import { describe, expect, test } from "bun:test";

import {
  cleanText,
  decodeResidualEntities,
  normalizeStatus,
  normalizeValue,
  parseDate,
  parseIntValue,
  parseMoney,
  parseTenure,
  parseText,
  parseYear,
  splitLeadingInt,
} from "./normalize";

describe("text", () => {
  test("collapses whitespace and trims", () => {
    expect(parseText("  425  Ena Rd\n\t#302B ")).toBe("425 Ena Rd #302B");
    expect(parseText("a  b")).toBe("a b");
    expect(cleanText(undefined)).toBe("");
  });

  test("blank placeholders → null", () => {
    expect(parseText("")).toBeNull();
    expect(parseText("   ")).toBeNull();
    expect(parseText("--")).toBeNull();
    expect(parseText(" -- ")).toBeNull();
    expect(parseText("--/--")).toBeNull();
    expect(parseText("--/mo.")).toBeNull();
    expect(parseText(null)).toBeNull();
  });

  test("keeps values that merely contain dashes", () => {
    expect(parseText("$735/--")).toBe("$735/--");
    expect(parseText("-0-")).toBe("-0-");
    expect(parseText("8-14")).toBe("8-14");
  });
});

describe("int", () => {
  test("parses grouped integers", () => {
    expect(parseIntValue("33,018")).toBe(33018);
    expect(parseIntValue(" 588 ")).toBe(588);
    expect(parseIntValue("0")).toBe(0);
    expect(parseIntValue("1,356.6")).toBe(1357);
  });

  test("non-numeric → null", () => {
    expect(parseIntValue("--")).toBeNull();
    expect(parseIntValue("")).toBeNull();
    expect(parseIntValue("One")).toBeNull();
    expect(parseIntValue("3 - Garage")).toBeNull();
    expect(parseIntValue("15-20")).toBeNull();
    expect(parseIntValue(undefined)).toBeNull();
  });
});

describe("money", () => {
  test("whole dollars from the site's formats", () => {
    expect(parseMoney("$18,500,000 (FS)")).toBe(18500000);
    expect(parseMoney("$108,000 (LH)")).toBe(108000);
    expect(parseMoney("$1,297/mo.")).toBe(1297);
    expect(parseMoney("$569,900.00")).toBe(569900);
    expect(parseMoney("$569,900.50")).toBe(569901);
    expect(parseMoney("$0")).toBe(0);
    expect(parseMoney("  $ 97 ")).toBe(97);
    expect(parseMoney("1490")).toBe(1490);
  });

  test("placeholders and free text → null", () => {
    expect(parseMoney("--/mo.")).toBeNull();
    expect(parseMoney("--")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("AVAILABLE")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
});

describe("date", () => {
  test("long-form and slash dates → ISO", () => {
    expect(parseDate("December 31, 2024")).toBe("2024-12-31");
    expect(parseDate("April 06, 2026")).toBe("2026-04-06");
    expect(parseDate("09/18/2026")).toBe("2026-09-18");
    expect(parseDate("1/2/2026")).toBe("2026-01-02");
    expect(parseDate("Sep 5 2026")).toBe("2026-09-05");
    expect(parseDate("Friday, September 18, 2026")).toBe("2026-09-18");
    expect(parseDate("2024-12-31")).toBe("2024-12-31");
    expect(parseDate("February 29, 2024")).toBe("2024-02-29");
  });

  test("dates at the edges of a day do not drift with the timezone", () => {
    expect(parseDate("January 1, 2026")).toBe("2026-01-01");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
  });

  test("invalid → null", () => {
    expect(parseDate("--")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("February 30, 2026")).toBeNull();
    expect(parseDate("February 29, 2025")).toBeNull();
    expect(parseDate("13/01/2026")).toBeNull();
    expect(parseDate("Smarch 3, 2026")).toBeNull();
    expect(parseDate("2026-00-06")).toBeNull();
    expect(parseDate("soon")).toBeNull();
  });
});

describe("year", () => {
  test("four-digit years in range", () => {
    expect(parseYear("1947")).toBe(1947);
    expect(parseYear(" 2026 ")).toBe(2026);
    expect(parseYear("1800")).toBe(1800);
    expect(parseYear("2100")).toBe(2100);
  });

  test("zero, out-of-range and junk → null", () => {
    expect(parseYear("0")).toBeNull();
    expect(parseYear("1799")).toBeNull();
    expect(parseYear("2101")).toBeNull();
    expect(parseYear("9999")).toBeNull();
    expect(parseYear("--")).toBeNull();
    expect(parseYear("19471")).toBeNull();
  });
});

describe("normalizeValue", () => {
  test("dispatches on kind", () => {
    expect(normalizeValue("text", " Metro  Oahu ")).toBe("Metro Oahu");
    expect(normalizeValue("int", "33,018")).toBe(33018);
    expect(normalizeValue("money", "$1,297/mo.")).toBe(1297);
    expect(normalizeValue("date", "December 31, 2024")).toBe("2024-12-31");
    expect(normalizeValue("year", "0")).toBeNull();
  });

  test("'--' is null for every kind", () => {
    for (const kind of ["text", "int", "money", "date", "year"] as const) {
      expect(normalizeValue(kind, "--")).toBeNull();
      expect(normalizeValue(kind, undefined)).toBeNull();
    }
  });
});

describe("parseTenure", () => {
  test("reads the price suffix", () => {
    expect(parseTenure("$402,730 (FS)")).toBe("FS");
    expect(parseTenure("$108,000 (LH)")).toBe("LH");
    expect(parseTenure("$108,000 (lh)")).toBe("LH");
    expect(parseTenure("$108,000")).toBeNull();
    expect(parseTenure("$108,000 (XX)")).toBeNull();
    expect(parseTenure(null)).toBeNull();
  });
});

describe("splitLeadingInt", () => {
  test("count plus description", () => {
    expect(splitLeadingInt("3 - Boat, Driveway, Garage")).toEqual({
      n: 3,
      rest: "Boat, Driveway, Garage",
    });
    expect(splitLeadingInt("0 - None, Street")).toEqual({
      n: 0,
      rest: "None, Street",
    });
  });

  test("only the first ' - ' splits", () => {
    expect(splitLeadingInt("1 - Assigned, Covered - 1, Guest")).toEqual({
      n: 1,
      rest: "Assigned, Covered - 1, Guest",
    });
  });

  test("bare number, no number, blank", () => {
    expect(splitLeadingInt("3")).toEqual({ n: 3, rest: null });
    expect(splitLeadingInt("3 - ")).toEqual({ n: 3, rest: null });
    expect(splitLeadingInt("Garage, Street")).toEqual({
      n: null,
      rest: "Garage, Street",
    });
    expect(splitLeadingInt("3 Car+")).toEqual({ n: null, rest: "3 Car+" });
    expect(splitLeadingInt("--")).toEqual({ n: null, rest: null });
    expect(splitLeadingInt("")).toEqual({ n: null, rest: null });
  });
});

describe("normalizeStatus", () => {
  test("maps the site vocabulary, case-insensitively", () => {
    expect(normalizeStatus("Active")).toBe("active");
    expect(normalizeStatus("Active Under Contract")).toBe(
      "active_under_contract",
    );
    expect(normalizeStatus("  active   under contract ")).toBe(
      "active_under_contract",
    );
    expect(normalizeStatus("Pending")).toBe("pending");
    expect(normalizeStatus("SOLD")).toBe("sold");
  });

  test("anything else is unknown", () => {
    expect(normalizeStatus("Withdrawn")).toBe("unknown");
    expect(normalizeStatus("")).toBe("unknown");
    expect(normalizeStatus(null)).toBe("unknown");
  });
});

describe("decodeResidualEntities", () => {
  test("decodes what double-encoding leaves behind", () => {
    expect(decodeResidualEntities("seller&#39;s")).toBe("seller's");
    expect(decodeResidualEntities("seller&amp;#39;s")).toBe("seller's");
    expect(
      decodeResidualEntities("A &amp; B&nbsp;C &quot;D&quot; &#x41;"),
    ).toBe('A & B C "D" A');
  });

  test("leaves plain ampersands and unknown names alone", () => {
    expect(decodeResidualEntities("C&C, Of Record")).toBe("C&C, Of Record");
    expect(decodeResidualEntities("AT&T; &bogus;")).toBe("AT&T; &bogus;");
  });
});
