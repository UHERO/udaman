import { describe, expect, test } from "bun:test";

import { buildInsertSql, buildUpdateSql, DCCA_COLUMNS } from "./load";
import { indexCandidates, matchProfile, preferProfile } from "./match";
import type { CondoCandidate } from "./match";
import type { DccaProfile } from "./types";

function profile(over: Partial<DccaProfile> = {}): DccaProfile {
  return {
    reg: "6368",
    name: "WIEST CONDOMINIUM",
    address: "524 KAI HELE KU ST, LAHAINA, HI 96761",
    street: "524 KAI HELE KU ST",
    city: "LAHAINA",
    state: "HI",
    zip: "96761",
    developer: "WILLIAM M WIEST",
    zoning: "AG",
    tmkRaw: "247009031",
    tmk: "2-4-7-009-031-0000",
    buildings: 2,
    floors: 1,
    totalUnits: 2,
    residential: 0,
    commercial: 0,
    agricultural: 1,
    parking: 0,
    toolSheds: 0,
    other: 1,
    ohana: "No",
    converted: "Yes",
    landOwnership: "FEE SIMPLE",
    filings: [],
    extra: {},
    url: "https://web3.dcca.hawaii.gov/reb/public/result2?reg=6368",
    ...over,
  };
}

const rows: CondoCandidate[] = [
  {
    tmk: "2-4-7-009-031-0000",
    projectName: "ARAKAKI FAMILY CONDOMINIUM",
    unitCount: 2,
  },
  { tmk: "1-2-3-004-005-0000", projectName: "'AINA MAUKA", unitCount: 12 },
  { tmk: "3-7-5-001-002-0000", projectName: "HALE NANEA", unitCount: 8 },
  {
    tmk: "3-7-5-001-009-0000",
    projectName: "Hale Nanea Condominiums",
    unitCount: 20,
  },
  { tmk: "1-9-9-001-001-0000", projectName: "HALE NANEA", unitCount: 8 },
];
const index = indexCandidates(rows);

describe("matchProfile", () => {
  test("a TMK the DB knows wins, and reports whether the names agree", () => {
    const m = matchProfile(profile(), index);
    expect(m).toEqual({
      kind: "tmk",
      candidate: rows[0],
      nameAgrees: false,
    });
    const agree = matchProfile(profile({ name: "Arakaki Family" }), index);
    expect(agree.kind === "tmk" && agree.nameAgrees).toBe(true);
  });

  test("an unknown TMK falls back to a unique normalized name", () => {
    const m = matchProfile(
      profile({
        name: "'AINA MAUKA CONDOMINIUMS",
        tmkRaw: "123004099",
        tmk: "1-2-3-004-099-0000",
      }),
      index,
    );
    expect(m).toEqual({ kind: "name", candidate: rows[1], tmkAgrees: false });
  });

  test("a name shared by several rows is narrowed by island, then unit count", () => {
    // Three "HALE NANEA" rows: two on Hawaii (8 and 20 units), one on Oahu.
    const bigIsland = matchProfile(
      profile({
        name: "HALE NANEA CONDOMINIUMS (514B, HRS)",
        tmkRaw: "375001999",
        tmk: "3-7-5-001-999-0000",
        totalUnits: 20,
      }),
      index,
    );
    expect(bigIsland.kind === "name" && bigIsland.candidate.tmk).toBe(
      "3-7-5-001-009-0000",
    );

    const stillAmbiguous = matchProfile(
      profile({
        name: "HALE NANEA",
        tmkRaw: "375001999",
        tmk: "3-7-5-001-999-0000",
        totalUnits: 50,
      }),
      index,
    );
    expect(stillAmbiguous).toMatchObject({ kind: "none", reason: "ambiguous" });
    expect(
      stillAmbiguous.kind === "none" && stillAmbiguous.candidates?.length,
    ).toBe(2);

    const noTmkAtAll = matchProfile(
      profile({ name: "HALE NANEA", tmkRaw: null, tmk: null, totalUnits: 8 }),
      index,
    );
    // No island to narrow by: two 8-unit rows remain.
    expect(noTmkAtAll).toMatchObject({ kind: "none", reason: "ambiguous" });
  });

  test("nothing fits → unmatched, or no-tmk when the register had no usable TMK", () => {
    expect(
      matchProfile(
        profile({ name: "NOWHERE", tmk: "4-4-4-004-004-0000" }),
        index,
      ),
    ).toEqual({
      kind: "none",
      reason: "unmatched",
    });
    expect(
      matchProfile(
        profile({ name: "NOWHERE", tmkRaw: "bad", tmk: null }),
        index,
      ),
    ).toEqual({
      kind: "none",
      reason: "no-tmk",
    });
  });
});

describe("preferProfile", () => {
  test("TMK+name beats TMK beats name; ties go to the newer registration", () => {
    const c = rows[0];
    const byName = {
      profile: profile({ reg: "9000" }),
      match: { kind: "name", candidate: c, tmkAgrees: false } as const,
    };
    const byTmk = {
      profile: profile({ reg: "100" }),
      match: { kind: "tmk", candidate: c, nameAgrees: false } as const,
    };
    const byBoth = {
      profile: profile({ reg: "50" }),
      match: { kind: "tmk", candidate: c, nameAgrees: true } as const,
    };
    const byTmkNewer = {
      profile: profile({ reg: "200" }),
      match: { kind: "tmk", candidate: c, nameAgrees: false } as const,
    };
    const sorted = [byName, byTmk, byBoth, byTmkNewer].sort(preferProfile);
    expect(sorted.map((s) => s.profile.reg)).toEqual([
      "50",
      "200",
      "100",
      "9000",
    ]);
  });
});

describe("SQL builders", () => {
  test("update writes exactly the register-owned columns, keyed by the matched row", () => {
    const { sql, params } = buildUpdateSql("2-4-7-009-031-0000", profile());
    for (const col of DCCA_COLUMNS) expect(sql).toContain(`\`${col}\` = ?`);
    for (const legacy of [
      "project_name",
      "unit_count",
      "final_date",
      "preliminary_date",
    ]) {
      expect(sql).not.toContain(legacy);
    }
    expect(params.at(-1)).toBe("2-4-7-009-031-0000");
    expect(params.length).toBe(DCCA_COLUMNS.length + 1);
    expect(params[0]).toBe(
      "https://web3.dcca.hawaii.gov/reb/public/result2?reg=6368",
    );
    expect(params[DCCA_COLUMNS.indexOf("project_number")]).toBe("6368");
    expect(params[DCCA_COLUMNS.indexOf("ohana")]).toBe("No");
    expect(params[DCCA_COLUMNS.indexOf("land_ownership")]).toBe("FEE SIMPLE");
  });

  test("insert adds tmk, the register's name and total units", () => {
    const { sql, params } = buildInsertSql("2-4-7-009-031-0000", profile());
    expect(
      sql.startsWith(
        "INSERT INTO condominium_projects (`tmk`, `project_name`, `unit_count`, `dcca_link`",
      ),
    ).toBe(true);
    expect(params.slice(0, 3)).toEqual([
      "2-4-7-009-031-0000",
      "WIEST CONDOMINIUM",
      2,
    ]);
    expect((sql.match(/\?/g) ?? []).length).toBe(params.length);
  });
});
