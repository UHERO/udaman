import { describe, expect, it } from "bun:test";

import {
  GENERIC_IDENTITY_FIELDS,
  GENERIC_MATCH_UPDATE,
  groupRowsByKey,
  pairSnapshotGroup,
} from "./qpub-load";
import { DELTA_STRATEGY } from "./qpub-delta-strategy";
import { TABLE_CONFIGS } from "@/core/crawlers/qpub/table-config";

// ─── groupRowsByKey ─────────────────────────────────────────────────

describe("groupRowsByKey", () => {
  it("groups rows sharing key values, preserving order", () => {
    const rows = [
      { k: "A", v: 1 },
      { k: "B", v: 2 },
      { k: "A", v: 3 },
    ];
    const groups = [...groupRowsByKey(rows, (r) => [r.k]).values()];
    expect(groups).toEqual([
      [
        { k: "A", v: 1 },
        { k: "A", v: 3 },
      ],
      [{ k: "B", v: 2 }],
    ]);
  });

  // DECIMAL columns come back from the DB as "5.0000" while dec() yields 5 —
  // the two must land in the same group or every reload starts a new identity.
  it("canonicalizes numeric representations", () => {
    const rows = [{ a: "5.0000" }, { a: 5 }];
    const groups = groupRowsByKey(rows, (r) => [r.a]);
    expect(groups.size).toBe(1);
  });

  it("treats null, undefined and empty string as one key value", () => {
    const rows = [{ a: null }, { a: undefined }, { a: "" }, { a: "  " }];
    const groups = groupRowsByKey(rows, (r) => [r.a]);
    expect(groups.size).toBe(1);
  });

  it("keeps genuinely different keys apart", () => {
    // The land_classifications case: same classification, different sizes.
    const rows = [
      { c: "AGRICULTURAL", sqft: 5000, acres: "0.1148" },
      { c: "AGRICULTURAL", sqft: 217800, acres: "5.0000" },
    ];
    const groups = groupRowsByKey(rows, (r) => [r.c, r.sqft, r.acres]);
    expect(groups.size).toBe(2);
  });

  it("compares multi-part keys per position", () => {
    const rows = [
      { a: "x y", b: "z" },
      { a: "x", b: "y z" },
    ];
    const groups = groupRowsByKey(rows, (r) => [r.a, r.b]);
    expect(groups.size).toBe(2);
  });
});

// ─── pairSnapshotGroup ──────────────────────────────────────────────

describe("pairSnapshotGroup", () => {
  // k=1 must behave exactly like the old single-row upsertSnapshot.
  it("k=1: matching data updates the latest row", () => {
    const existing = [{ id: 10, value: "100" }];
    expect(pairSnapshotGroup([{ value: 100 }], existing)).toEqual([
      { kind: "update", row: existing[0] },
    ]);
  });

  it("k=1: changed data inserts a new version", () => {
    expect(pairSnapshotGroup([{ value: 200 }], [{ id: 10, value: "100" }])).toEqual([
      { kind: "insert" },
    ]);
  });

  it("k=1: no existing row inserts", () => {
    expect(pairSnapshotGroup([{ value: 100 }], [])).toEqual([{ kind: "insert" }]);
  });

  // The verified real case: two identical "FRAME UTILITY SHED / 1927"
  // structures on one Maui parcel. Under 1-vs-latest each saw the other's
  // version as changed and the pair doubled on every load; here each claims
  // its own existing row.
  it("pairs k identical incoming rows against k identical existing rows", () => {
    const shed = { description: "FRAME UTILITY SHED", year_built: "1927" };
    const existing = [
      { id: 21, description: "FRAME UTILITY SHED", year_built: "1927" },
      { id: 20, description: "FRAME UTILITY SHED", year_built: "1927" },
    ];
    const actions = pairSnapshotGroup([shed, shed], existing);
    expect(actions).toEqual([
      { kind: "update", row: existing[0] },
      { kind: "update", row: existing[1] },
    ]);
  });

  it("inserts the shortfall when fewer existing rows than incoming", () => {
    const shed = { description: "SHED" };
    const existing = [{ id: 20, description: "SHED" }];
    expect(pairSnapshotGroup([shed, shed, shed], existing)).toEqual([
      { kind: "update", row: existing[0] },
      { kind: "insert" },
      { kind: "insert" },
    ]);
  });

  // Existing rows arrive most-recent-first (id DESC) — the reverse of page
  // order. Strict Nth-to-Nth pairing would compare row A against row B's
  // version, see both as "changed", and reintroduce the doubling this whole
  // mechanism exists to fix. Claiming by data match keeps mixed-data groups
  // stable across loads.
  it("claims by data match, not position, for mixed-data groups", () => {
    const existing = [
      { id: 31, value: "B" }, // most recent (inserted second)
      { id: 30, value: "A" },
    ];
    const actions = pairSnapshotGroup([{ value: "A" }, { value: "B" }], existing);
    expect(actions).toEqual([
      { kind: "update", row: existing[1] },
      { kind: "update", row: existing[0] },
    ]);
  });

  it("does not let two incoming rows claim the same existing row", () => {
    const existing = [{ id: 40, value: "X" }];
    const actions = pairSnapshotGroup([{ value: "X" }, { value: "X" }], existing);
    expect(actions).toEqual([
      { kind: "update", row: existing[0] },
      { kind: "insert" },
    ]);
  });

  it("normalizes numeric and null representations when matching", () => {
    const existing = [{ id: 50, amount: "1250.00", note: null }];
    const actions = pairSnapshotGroup([{ amount: 1250, note: "" }], existing);
    expect(actions).toEqual([{ kind: "update", row: existing[0] }]);
  });
});

// ─── Configuration consistency ──────────────────────────────────────

describe("identity configuration", () => {
  // appeals, dedications and home_exemptions lack last_year_observed, so they
  // can never take the snapshot path — their keys live in
  // GENERIC_MATCH_UPDATE instead.
  it("routes appeals, dedications and home_exemptions through match-update, not snapshot", () => {
    expect(GENERIC_MATCH_UPDATE.appeals).toEqual(["year", "appeal_type_value"]);
    expect(GENERIC_MATCH_UPDATE.dedications).toEqual(["tax_year"]);
    expect(GENERIC_MATCH_UPDATE.home_exemptions).toEqual([
      "tax_year",
      "claimant_name",
    ]);
    expect(GENERIC_IDENTITY_FIELDS.appeals).toBeUndefined();
    expect(GENERIC_IDENTITY_FIELDS.dedications).toBeUndefined();
    expect(GENERIC_IDENTITY_FIELDS.home_exemptions).toBeUndefined();
  });

  it("keeps yard_improvements' identity unchanged — occurrence handling covers identical structures", () => {
    expect(GENERIC_IDENTITY_FIELDS.yard_improvements).toEqual([
      "building_number",
      "description",
      "year_built",
      "area",
    ]);
  });

  // The delta SQL generator and the parse audit both read DELTA_STRATEGY; the
  // loaders are the specification. These pin the two to the same keys.
  it("delta strategy mirrors the widened loader keys", () => {
    expect(DELTA_STRATEGY.owners).toEqual({
      kind: "match-natural",
      match: ["owner_name", "owner_type", "owner_address"],
    });
    expect(DELTA_STRATEGY.sales).toEqual({
      kind: "match-natural",
      match: [
        "sale_date",
        "instrument",
        "land_court_document_number",
        "book_page",
        "sale_amount",
      ],
    });
    expect(DELTA_STRATEGY.land_classifications).toEqual({
      kind: "scd",
      identity: ["land_classification", "square_footage", "acreage"],
    });
    expect(DELTA_STRATEGY.appeals).toEqual({
      kind: "match-natural",
      match: ["year", "appeal_type_value"],
    });
    // UNIQUE unique_home_exemption (tmk, tax_year, claimant_name) in
    // hhdb-schema.sql backs the upsert.
    expect(DELTA_STRATEGY.home_exemptions).toEqual({
      kind: "upsert-key",
      key: ["tmk", "tax_year", "claimant_name"],
    });
  });

  it("table-config natural keys agree with the loaders", () => {
    expect(TABLE_CONFIGS.owners.naturalKey).toEqual([
      "tmk",
      "owner_name",
      "owner_type",
      "owner_address",
    ]);
    expect(TABLE_CONFIGS.land_classifications.naturalKey).toEqual([
      "tmk",
      "land_classification",
      "square_footage",
      "acreage",
    ]);
    expect(TABLE_CONFIGS.sales.naturalKey).toEqual([
      "tmk",
      "sale_date",
      "instrument",
      "land_court_document_number",
      "book_page",
      "sale_amount",
    ]);
    expect(TABLE_CONFIGS.appeals.naturalKey).toEqual([
      "tmk",
      "year",
      "appeal_type_value",
    ]);
    expect(TABLE_CONFIGS.home_exemptions.naturalKey).toEqual([
      "tmk",
      "tax_year",
      "claimant_name",
    ]);
  });

  // Permits: explicit user decision — no change (3 duplicate rows ever).
  it("leaves permits untouched", () => {
    expect(DELTA_STRATEGY.permits).toEqual({
      kind: "match-natural",
      match: ["permit_number"],
    });
    expect(TABLE_CONFIGS.permits.naturalKey).toEqual(["tmk", "permit_number"]);
  });
});
