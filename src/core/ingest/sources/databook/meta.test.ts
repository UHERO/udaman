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

describe("units named by words", () => {
  const unit = (labels: string[], headnote = "", title = "") =>
    inferUnit({ headnote, labels, title, percent: false }).longLabel;

  it("reads a measure word starting or ending a label", () => {
    expect(unit(["Pounds landed of commercial fish [a]"])).toBe("Pounds");
    expect(unit(["Buildings owned square feet"])).toBe("Sq. Ft.");
    expect(unit(["Kilauea", "Area covered by lava flows km2"])).toBe("Sq. Km.");
    expect(unit(["Square miles"])).toBe("Sq. Mi.");
    expect(unit(["Acreage owned"])).toBe("Acres");
  });

  it("does not read places, ages or degrees as units", () => {
    expect(unit(["Ft. DeRussey", "Rooms"])).not.toBe("Feet");
    expect(unit(["Total", "18 to 64 years"], "", "Population by age")).toBe(
      "Persons",
    );
    expect(unit(["Degrees conferred"])).not.toBe("Degrees F");
  });

  it("reads a unit parenthetical in the middle of a label", () => {
    expect(unit(["Kona", "Mail (U.S. tons): incoming"])).toBe("Short Tons");
  });

  it("reads a headnote that is only a unit", () => {
    expect(unit(["Total", "Ground water"], "[Million gallons per day]")).toBe(
      "Millions of Gallons per Day",
    );
  });

  it("names what a count counts", () => {
    expect(unit(["Number of commercial fishermen"])).toBe(
      "Number of Commercial Fishermen",
    );
    expect(unit(["511", "Publishing", "Paid employees"])).toBe(
      "Number of Paid Employees",
    );
    expect(
      unit([
        "Kind of business subject to federal income tax",
        "62",
        "Number of establishments",
      ]),
    ).toBe("Number of Establishments");
    expect(
      unit(["No. of paid employees for pay period including March 12"]),
    ).toBe("Number of Paid Employees");
    expect(unit(["Establishments (number)"])).toBe("Number of Establishments");
    expect(unit(["Salaries and wages no. of returns"])).toBe(
      "Number of Returns",
    );
    expect(unit(["Kaiminani", "Resident population"])).toBe("Persons");
    expect(unit(["Total population", "In households"])).toBe("Persons");
    expect(unit(["Total housing units"])).toBe("Units");
    expect(
      unit(["311", "Food manufacturing", "Annual average employment"]),
    ).toBe("Jobs");
    expect(unit(["Total"], "", "NUMBER OF U.S. POST OFFICES, BY ISLAND")).toBe(
      "Number of U.S. Post Offices",
    );
  });

  it("does not call ratios or money counts", () => {
    expect(unit(["Males per 100 females"], "", "Population")).toBe("Number");
    expect(unit(["Average household size"])).toBe("Number");
    expect(unit(["Total", "Payroll full-time employees"])).toBe("Number");
    expect(unit(["Total including charter schools"])).toBe("Number");
  });

  it("reads ranks, years and rates per 100,000", () => {
    expect(unit(["Overall ranking"])).toBe("Rank");
    expect(
      unit(["0 to 1", "Expected number of years remaining at each age (male)"]),
    ).toBe("Years");
    expect(
      unit([
        "Number surviving to specified age per 100,000 born alive (total)",
      ]),
    ).toBe("Rate per 100,000");
  });
});
