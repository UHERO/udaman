import { expect, describe as group, it } from "bun:test";

import {
  cleanPanelLabel,
  describe,
  portalNames,
  stripTitlePeriods,
  tableSubject,
} from "./naming";

const T107 =
  "PERCENTAGE CHANGE IN RESIDENT POPULATION, BY COUNTY, 2010 TO 2025, AND ANNUAL GROWTH RATE IN RESIDENT POPULATION, BY COUNTY, 1990-2000 TO 2020-2025";

group("cleanPanelLabel", () => {
  it("drops period-column headers and keeps the measure part", () => {
    expect(cleanPanelLabel("Date")).toBe("");
    expect(cleanPanelLabel("Year")).toBe("");
    expect(cleanPanelLabel("Year for annual growth rate")).toBe(
      "Annual growth rate",
    );
    expect(cleanPanelLabel("Deaths by year")).toBe("Deaths");
    expect(cleanPanelLabel("Honolulu harbor by commodity")).toBe(
      "Honolulu harbor by commodity",
    );
  });
});

group("titles", () => {
  it("strips year ranges and finds the subject", () => {
    expect(stripTitlePeriods(T107)).toBe(
      "PERCENTAGE CHANGE IN RESIDENT POPULATION, BY COUNTY, AND ANNUAL GROWTH RATE IN RESIDENT POPULATION, BY COUNTY",
    );
    expect(tableSubject(T107)).toBe("Percentage Change in Resident Population");
    expect(tableSubject("RESIDENT POPULATION BY AGE GROUP, BY COUNTY")).toBe(
      "Resident Population",
    );
  });
});

group("portalNames", () => {
  it("uses the table subject when geography took the only dimension (01.07)", () => {
    expect(
      portalNames([{ panelLabel: "Date", rowDims: [], colDims: [] }], T107),
    ).toEqual(["Percentage Change in Resident Population"]);
  });

  it("combines row and column leaves so rows are distinguishable (09.65)", () => {
    const names = portalNames(
      [
        {
          panelLabel: "",
          rowDims: ["Total"],
          colDims: ["Employment full-time"],
        },
        {
          panelLabel: "",
          rowDims: ["Total", "Education"],
          colDims: ["Employment full-time"],
        },
        {
          panelLabel: "",
          rowDims: ["Total", "Police"],
          colDims: ["Employment full-time"],
        },
      ],
      "LOCAL GOVERNMENT EMPLOYMENT AND PAYROLL, BY FUNCTION",
    );
    expect(names).toEqual([
      "Total: Employment full-time",
      "Education: Employment full-time",
      "Police: Employment full-time",
    ]);
  });

  it("adds parents only where names collide", () => {
    const names = portalNames(
      [
        { panelLabel: "", rowDims: ["Under 18 years", "Male"], colDims: [] },
        { panelLabel: "", rowDims: ["65 years and over", "Male"], colDims: [] },
        { panelLabel: "", rowDims: ["Median age"], colDims: [] },
      ],
      "RESIDENT POPULATION, BY AGE AND SEX",
    );
    expect(names).toEqual([
      "Under 18 years: Male",
      "65 years and over: Male",
      "Median age",
    ]);
  });

  it("never leaves a bare generic label", () => {
    expect(
      portalNames(
        [{ panelLabel: "", rowDims: [], colDims: ["Total"] }],
        "VISITOR ARRIVALS, BY MONTH",
      ),
    ).toEqual(["Visitor Arrivals: Total"]);
  });

  it("uses meaningful panel labels to separate otherwise identical names", () => {
    const names = portalNames(
      [
        {
          panelLabel: "Live births by year",
          rowDims: [],
          colDims: ["All groups"],
        },
        { panelLabel: "Deaths by year", rowDims: [], colDims: ["All groups"] },
      ],
      "BIRTHS AND DEATHS, BY MILITARY STATUS",
    );
    expect(names).toEqual(["Live births: All groups", "Deaths: All groups"]);
  });

  it("numbers fully identical paths", () => {
    expect(
      portalNames(
        [
          { panelLabel: "Year", rowDims: [], colDims: ["Senate"] },
          { panelLabel: "Year", rowDims: [], colDims: ["Senate"] },
        ],
        "PARTY MEMBERSHIP OF THE STATE LEGISLATURE",
      ),
    ).toEqual(["Senate", "Senate (2)"]);
  });
});

group("describe", () => {
  it("gives the cleaned title and the full path", () => {
    expect(
      describe(T107, { panelLabel: "Date", rowDims: [], colDims: [] }, null),
    ).toBe(
      "Percentage Change in Resident Population, by County, and Annual Growth Rate in Resident Population, by County",
    );
    expect(
      describe(
        "LOCAL GOVERNMENT EMPLOYMENT AND PAYROLL, BY FUNCTION",
        {
          panelLabel: "",
          rowDims: ["Total", "Police"],
          colDims: ["Employment full-time"],
        },
        "As of March",
      ),
    ).toBe(
      "Local Government Employment and Payroll, by Function — Total > Police > Employment full-time (As of March)",
    );
  });
});

group("portalNames codes", () => {
  it("drops industry codes next to a text label but keeps code-only rows", () => {
    expect(
      portalNames(
        [
          {
            panelLabel: "",
            rowDims: ["62", "Health care and social assistance"],
            colDims: ["Number of employees"],
          },
          { panelLabel: "", rowDims: ["96816"], colDims: ["No. of returns"] },
          { panelLabel: "", rowDims: ["96734"], colDims: ["No. of returns"] },
        ],
        "TABLE",
      ),
    ).toEqual([
      "Health care and social assistance: Number of employees",
      "96816: No. of returns",
      "96734: No. of returns",
    ]);
  });
});

group("portalNames units", () => {
  const n = (colDims: string[]) => ({ panelLabel: "", rowDims: [], colDims });
  it("drops unit parentheticals unless they tell measurements apart", () => {
    expect(
      portalNames(
        [
          n(["Average weekly earnings (dollars)"]),
          n(["Land area (sq. km.)"]),
          n(["Land area (sq. mi.)"]),
        ],
        "TITLE",
      ),
    ).toEqual([
      "Average weekly earnings",
      "Land area (sq. km.)",
      "Land area (sq. mi.)",
    ]);
  });
});
