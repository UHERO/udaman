import { describe, expect, it } from "bun:test";

import { isTaxBillRollupRow, realTaxBillRows, type Row } from "./qpub-load";

/** The three rows qPublic renders for a typical parcel. */
const REAL_PERIOD_1: Row = {
  tax_period: "2026-1",
  description: "Property Tax",
  original_due_date: "08/20/2026",
  amount_due: "$150.00",
};
const REAL_PERIOD_2: Row = {
  tax_period: "2026-2",
  description: "Property Tax",
  original_due_date: "02/22/2027",
  amount_due: "$150.00",
};
const ROLLUP: Row = {
  tax_period: "",
  description: "Tax Bill with Interest computed through 08/20/2026",
  original_due_date: null,
  amount_due: "$300.00",
};

describe("isTaxBillRollupRow", () => {
  it("flags the blank-period summary line", () => {
    expect(isTaxBillRollupRow(ROLLUP)).toBe(true);
  });

  it("keeps rows that name a period", () => {
    expect(isTaxBillRollupRow(REAL_PERIOD_1)).toBe(false);
    expect(isTaxBillRollupRow(REAL_PERIOD_2)).toBe(false);
  });

  it("treats null, undefined and whitespace periods as the rollup", () => {
    expect(isTaxBillRollupRow({ tax_period: null })).toBe(true);
    expect(isTaxBillRollupRow({})).toBe(true);
    expect(isTaxBillRollupRow({ tax_period: "   " })).toBe(true);
  });

  // "PRIOR" is a real bucket in the data (6,781 rows) — it names a period even
  // though it isn't year-half shaped, so it must survive the filter.
  it("keeps the non-numeric PRIOR period", () => {
    expect(isTaxBillRollupRow({ tax_period: "PRIOR" })).toBe(false);
  });
});

describe("realTaxBillRows", () => {
  it("drops only the summary line", () => {
    const kept = realTaxBillRows([REAL_PERIOD_1, REAL_PERIOD_2, ROLLUP]);
    expect(kept).toEqual([REAL_PERIOD_1, REAL_PERIOD_2]);
  });

  // A parcel scraped mid-year may only have period 1 — that's a complete
  // table, not a truncated one, and must not be treated as empty.
  it("handles a parcel that only has the first period yet", () => {
    expect(realTaxBillRows([REAL_PERIOD_1, ROLLUP])).toEqual([REAL_PERIOD_1]);
  });

  it("returns nothing when the rollup is the only row", () => {
    expect(realTaxBillRows([ROLLUP])).toEqual([]);
  });

  it("leaves an already-clean table untouched", () => {
    const rows = [REAL_PERIOD_1, REAL_PERIOD_2];
    expect(realTaxBillRows(rows)).toEqual(rows);
  });
});
