import { describe, expect, it } from "bun:test";

import {
  COLUMN_VALUE_PARSERS,
  GENERIC_MATCH_UPDATE,
  GENERIC_SECTION_MAP,
  SECTION_ROW_TRANSFORMS,
  splitHomesteadInformation,
} from "./qpub-load";
import { TABLE_COLUMNS } from "./qpub-extract";
import { DELTA_STRATEGY } from "./qpub-delta-strategy";

// ─── splitHomesteadInformation ──────────────────────────────────────

describe("splitHomesteadInformation", () => {
  it("splits the packed claimant/year cell", () => {
    expect(splitHomesteadInformation("SODEN,TAMMY 2025")).toEqual({
      claimant_name: "SODEN,TAMMY",
      tax_year: 2025,
    });
  });

  // Names carry internal spaces (middle initials) and commas — only the
  // trailing 4-digit year is structural.
  it("keeps internal spaces and commas in the name", () => {
    expect(splitHomesteadInformation("DAVIS,GREGORY S 2025")).toEqual({
      claimant_name: "DAVIS,GREGORY S",
      tax_year: 2025,
    });
    expect(splitHomesteadInformation("SHISHIDO,WENDY M I T 2026")).toEqual({
      claimant_name: "SHISHIDO,WENDY M I T",
      tax_year: 2026,
    });
  });

  it("handles ampersands and other punctuation in names", () => {
    expect(splitHomesteadInformation("SMITH,JOHN & JANE 2026")).toEqual({
      claimant_name: "SMITH,JOHN & JANE",
      tax_year: 2026,
    });
  });

  // No trailing year → the whole string is still the claimant; the name is
  // data even when the year is missing.
  it("keeps the whole string as claimant when no trailing year", () => {
    expect(splitHomesteadInformation("SODEN,TAMMY")).toEqual({
      claimant_name: "SODEN,TAMMY",
      tax_year: null,
    });
  });

  it("returns nulls for empty input", () => {
    expect(splitHomesteadInformation(null)).toEqual({
      claimant_name: null,
      tax_year: null,
    });
    expect(splitHomesteadInformation(undefined)).toEqual({
      claimant_name: null,
      tax_year: null,
    });
    expect(splitHomesteadInformation("  ")).toEqual({
      claimant_name: null,
      tax_year: null,
    });
  });
});

// ─── Section routing ────────────────────────────────────────────────

describe("home_exemption_information routing", () => {
  it("maps the section to home_exemptions", () => {
    expect(GENERIC_SECTION_MAP.home_exemption_information).toBe(
      "home_exemptions",
    );
  });

  it("transform unpacks the row and drops the packed field", () => {
    const transform = SECTION_ROW_TRANSFORMS.home_exemption_information;
    expect(
      transform({ homestead_information: "DAVIS,JOAN M 2026" }),
    ).toEqual({ claimant_name: "DAVIS,JOAN M", tax_year: 2026 });
  });

  it("transform leaves rows without the packed field untouched", () => {
    const transform = SECTION_ROW_TRANSFORMS.home_exemption_information;
    const row = { claimant_name: "X", tax_year: 2025 };
    expect(transform(row)).toEqual(row);
  });

  // tax_year must land numeric on both the row path and the extract path;
  // claimant_name must never be coerced.
  it("coerces tax_year but not claimant_name", () => {
    expect(COLUMN_VALUE_PARSERS.tax_year?.("2025")).toBe(2025);
    expect(COLUMN_VALUE_PARSERS.claimant_name).toBeUndefined();
  });

  it("extract columns cover exactly the loaded fields", () => {
    expect(TABLE_COLUMNS.home_exemptions).toEqual([
      "tmk",
      "scraped_at",
      "claimant_name",
      "tax_year",
    ]);
  });

  // No last_year_observed column, so the table can never take the snapshot
  // path — re-loads must update in place via the match key, which mirrors
  // UNIQUE unique_home_exemption (tmk, tax_year, claimant_name).
  it("match-update and delta keys agree with the unique key", () => {
    expect(GENERIC_MATCH_UPDATE.home_exemptions).toEqual([
      "tax_year",
      "claimant_name",
    ]);
    expect(DELTA_STRATEGY.home_exemptions).toEqual({
      kind: "upsert-key",
      key: ["tmk", "tax_year", "claimant_name"],
    });
  });
});
