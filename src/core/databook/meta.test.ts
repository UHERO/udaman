import { describe, expect, it } from "bun:test";

import { inferUnit, parseUnitText, splitLabelUnit } from "./meta";

const long = (text: string) => parseUnitText(text)?.longLabel ?? null;

describe("units written in labels", () => {
  it("reads unit parentheticals, with scales", () => {
    expect(long("dollars")).toBe("Dollars");
    expect(long("$1,000")).toBe("Thousands of Dollars");
    expect(long("$ 1,000")).toBe("Thousands of Dollars");
    expect(long("$1,000,000")).toBe("Millions of Dollars");
    expect(long("$m.")).toBe("Millions of Dollars");
    expect(long("million $")).toBe("Millions of Dollars");
    expect(long("in thousands")).toBe("Thousands");
    expect(long("1,000s")).toBe("Thousands");
    expect(long("1,000 kwh")).toBe("Thousands of kWh");
    expect(long("millions of gallons per day")).toBe(
      "Millions of Gallons per Day",
    );
    expect(long("sq. km.")).toBe("Sq. Km.");
    expect(long("per sq. mi.")).toBe("Per Sq. Mi.");
    expect(long("$/kwh")).toBe("$ per kWh");
    expect(long("2017=100")).toBe("Index (2017=100)");
    expect(long("millions of chained 2017 dollars")).toBe(
      "Millions of Chained 2017 Dollars",
    );
  });

  it("ignores parentheticals that are not units", () => {
    expect(long("incl. Kalawao")).toBeNull();
    expect(long("Optical/Infrared")).toBeNull();
    expect(long("2")).toBeNull();
    expect(long("acres bearing")).toBeNull();
  });

  it("splits the unit off a label", () => {
    expect(splitLabelUnit("All occupations (in thousands)")).toEqual({
      text: "All occupations",
      unit: { shortLabel: "Thous.", longLabel: "Thousands" },
    });
    expect(splitLabelUnit("Amount, in thousands of dollars").text).toBe(
      "Amount",
    );
    // A share keeps what it is a share of.
    expect(splitLabelUnit("Share (% of total)").text).toBe(
      "Share (% of total)",
    );
    // Two different units: none.
    expect(
      splitLabelUnit("Contract awards ($M) and personnel (number)").unit,
    ).toBeNull();
  });
});

describe("inferUnit", () => {
  const unit = (labels: string[], headnote = "") =>
    inferUnit({ headnote, labels, percent: false }).longLabel;

  it("prefers the labels' own unit over the headnote", () => {
    expect(unit(["All occupations (in thousands)", "Total"])).toBe("Thousands");
    expect(unit(["Receipts ($1,000)"], "[In dollars.]")).toBe(
      "Thousands of Dollars",
    );
  });

  it("lets a percent label win over a parent's unit", () => {
    expect(unit(["Amount ($M.)", "Hawaii as percent of U.S."])).toBe("Percent");
    expect(unit(["Industrial zone 50% exemption", "amount ($1,000)"])).toBe(
      "Thousands of Dollars",
    );
  });

  it("picks the matching half of a two-unit label", () => {
    const panel =
      "Value of contract awards performed ($M) and personnel (number)";
    expect(unit([panel, "Total"])).toBe("Millions of Dollars");
    expect(unit([panel, "Personnel", "Army"])).toBe("Number");
  });

  it("skips item descriptions listed under a code", () => {
    expect(
      unit(
        ["841112", "Turbojets of a thrust exceeding 25 kn (kilonewtons)"],
        "[In thousands of dollars.]",
      ),
    ).toBe("Thousands of Dollars");
  });
});
