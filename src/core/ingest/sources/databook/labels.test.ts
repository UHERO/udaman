import { describe, expect, it } from "bun:test";

import {
  extractUrl,
  labelKey,
  normalizeLabel,
  parsePeriod,
  parseTitle,
  snapshotPeriod,
  splitPeriod,
} from "./labels";

describe("normalizeLabel", () => {
  it("collapses legacy print spacing and strips slash footnotes", () => {
    expect(normalizeLabel("Maui                         County 2/")).toEqual({
      text: "Maui County",
      markers: ["2"],
    });
    expect(normalizeLabel("Maui\nCounty 2/").text).toBe("Maui County");
  });

  it("strips bracket footnotes, including compound ones", () => {
    expect(normalizeLabel("Maui County [b]")).toEqual({
      text: "Maui County",
      markers: ["b"],
    });
    expect(normalizeLabel("2006 Military personnel [a and b]").markers).toEqual(
      ["a", "b"],
    );
  });

  it("does not eat fractions", () => {
    expect(normalizeLabel("Under 1/2 acre").text).toBe("Under 1/2 acre");
  });

  it("joins line-break hyphenation", () => {
    expect(normalizeLabel("employ-\nment").text).toBe("employment");
  });

  it("keys ignore case and punctuation", () => {
    expect(labelKey("City & County of Honolulu")).toBe(
      labelKey("City and County of Honolulu"),
    );
  });
});

describe("parsePeriod", () => {
  it("parses calendar years, numeric or string, with markers", () => {
    expect(parsePeriod(2019)).toMatchObject({
      year: 2019,
      date: "2019-01-01",
      basis: "calendar",
    });
    expect(parsePeriod("2020 [c]")).toMatchObject({
      year: 2020,
      basis: "calendar",
    });
  });

  it("parses year-point labels", () => {
    expect(parsePeriod("2010: April 1")).toMatchObject({
      year: 2010,
      basis: "point",
      point: "April 1",
    });
    expect(parsePeriod("Dec. 31, 2010")).toMatchObject({
      year: 2010,
      basis: "point",
    });
    expect(parsePeriod("January 1, 2012")).toMatchObject({
      year: 2012,
      basis: "point",
    });
  });

  it("dates one-year spans by end year and uses context for the basis", () => {
    expect(
      parsePeriod("2019-2020", { text: "school enrollment" }),
    ).toMatchObject({
      year: 2020,
      basis: "school",
    });
    expect(parsePeriod("2018-19", { text: "FISCAL YEARS" })).toMatchObject({
      year: 2019,
      basis: "fiscal",
    });
    expect(parsePeriod("2005/2006")).toMatchObject({
      year: 2006,
      basis: "span1",
    });
    expect(parsePeriod("FY 2019")).toMatchObject({
      year: 2019,
      basis: "fiscal",
    });
  });

  it("treats multi-year and spaced spans as intervals", () => {
    expect(parsePeriod("1990 - 2000").basis).toBe("interval");
    expect(parsePeriod("2020-2030").basis).toBe("interval");
    expect(parsePeriod("1959-1961").basis).toBe("interval");
    expect(parsePeriod("2020 - 2021").basis).toBe("interval");
  });

  it("recognizes 5-year ACS windows from context", () => {
    expect(
      parsePeriod("2020-2024", { text: "American Community Survey 5-Year" }),
    ).toMatchObject({ year: 2024, basis: "acs5" });
  });

  it("returns unknown for non-periods", () => {
    expect(parsePeriod("State total").basis).toBe("unknown");
    expect(parsePeriod(1234567).basis).toBe("unknown");
  });
});

describe("splitPeriod", () => {
  it("separates a measure from its year", () => {
    expect(splitPeriod("Real SPI per capita 2018")).toMatchObject({
      period: { year: 2018 },
      residue: "Real SPI per capita",
    });
    expect(splitPeriod("April 1, 2020, Both sexes [a]")).toMatchObject({
      period: { year: 2020, basis: "point" },
      residue: "Both sexes",
    });
    expect(splitPeriod("Jobs in\n2017")?.residue).toBe("Jobs");
  });

  it("returns a bare period with empty residue", () => {
    expect(splitPeriod("1970")).toMatchObject({ residue: "" });
  });

  it("returns null with no or ambiguous years", () => {
    expect(splitPeriod("State total")).toBeNull();
    expect(splitPeriod("2019 to 2020 change in 2021")).toBeNull();
  });
});

describe("parseTitle / snapshotPeriod / extractUrl", () => {
  it("parses table titles", () => {
    expect(
      parseTitle("Table 1.06-- RESIDENT POPULATION, BY COUNTY:  2010 TO 2025"),
    ).toEqual({
      tableNum: "01.06",
      title: "RESIDENT POPULATION, BY COUNTY",
      period: "2010 TO 2025",
    });
    expect(parseTitle("Narrative").tableNum).toBeNull();
  });

  it("finds single snapshot periods only", () => {
    expect(snapshotPeriod("2025")?.year).toBe(2025);
    expect(snapshotPeriod("MARCH 31, 2026")?.year).toBe(2026);
    expect(snapshotPeriod("2010 TO 2025")).toBeNull();
    expect(snapshotPeriod("2020 AND 2025")).toBeNull();
  });

  it("extracts source URLs", () => {
    expect(
      extractUrl(
        "Source: Census <https://www.census.gov/popest.html> accessed",
      ),
    ).toBe("https://www.census.gov/popest.html");
  });
});

describe("parsePeriod edge cases", () => {
  it("only treats month/day text after 'YYYY:' as a point", () => {
    expect(parsePeriod("1996: Nov. 5").basis).toBe("point");
    expect(parsePeriod("2013: Wealthholders above $5.0 million").basis).toBe(
      "unknown",
    );
    expect(splitPeriod("2013: Wealthholders above $5.0 million")?.residue).toBe(
      "Wealthholders above $5.0 million",
    );
  });

  it("returns unknown for an Invalid Date", () => {
    expect(parsePeriod(new Date("nope")).basis).toBe("unknown");
  });
});
