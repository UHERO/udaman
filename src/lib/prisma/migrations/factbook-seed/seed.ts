/**
 * HHF Universe Seed Script
 *
 * One-time setup that populates the HHF universe with:
 *   1. Root + child categories (top-level) with sub-categories (data lists)
 *   2. Measurements (one per column prefix)
 *   3. Geographies (state, counties, ZCTAs)
 *
 * Uses rawQuery throughout to avoid Bun SQL connection pool issues with the
 * Collection methods' insertAndGetId + getById transaction pattern.
 *
 * Run: bun run src/lib/prisma/migrations/factbook-seed/seed.ts [--execute]
 *
 * Without --execute, runs in dry-run mode (prints what would be created).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { sanitizePrefix } from "@catalog/utils/factbook-parser";
import { mysql, rawQuery } from "@/lib/mysql/db";
import type { Universe } from "@catalog/types/shared";

const HHF: Universe = "HHF";
const DRY_RUN = !process.argv.includes("--execute");

// ─── Helpers ─────────────────────────────────────────────────────────

/** Insert a row and return the auto-increment ID via a single rawQuery + SELECT. */
async function insert(sql: string, params: unknown[]): Promise<number> {
  await rawQuery(sql, params as (string | number | Date)[]);
  const rows = await rawQuery<{ id: number }>(
    "SELECT LAST_INSERT_ID() as id",
  );
  return rows[0].id;
}

/** Find a single row ID or return null. */
async function findId(
  table: string,
  conditions: Record<string, string | number | null>,
): Promise<number | null> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    if (val === null) {
      clauses.push(`${col} IS NULL`);
    } else {
      clauses.push(`${col} = ?`);
      params.push(val);
    }
  }
  const rows = await rawQuery<{ id: number }>(
    `SELECT id FROM ${table} WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  );
  return rows[0]?.id ?? null;
}

// ─── Universe Structure ──────────────────────────────────────────────

type SubCategory = { name: string; columns: string[] };
type TopCategory = {
  name: string;
  displayName: string;
  subCategories: SubCategory[];
};

const UNIVERSE_STRUCTURE: TopCategory[] = [
  {
    name: "access",
    displayName: "Access",
    subCategories: [
      {
        name: "amenities",
        columns: [
          "poicount_grocery",
          "poicount_recreation",
          "poicount_restaurants_bars",
          "poicount_health",
        ],
      },
      {
        name: "jobs",
        columns: [
          "jobs_30",
          "jobs_d30",
          "jobs_t30",
          "jobs_d30_perc",
          "jobs_t30_perc",
        ],
      },
    ],
  },
  {
    name: "demographics",
    displayName: "Demographics",
    subCategories: [
      {
        name: "age-structure",
        columns: [
          "age>85",
          "age7584",
          "age6574",
          "age5564",
          "age4554",
          "age3544",
          "age2534",
          "age1824",
          "age0517",
          "age0004",
        ],
      },
      { name: "population", columns: ["population"] },
      {
        name: "racial-diversity",
        columns: ["asian", "white", "black", "hawpi"],
      },
      { name: "household-income", columns: ["medhhinc"] },
      { name: "unemployment", columns: ["unemployment"] },
      { name: "education", columns: ["col", "hs"] },
    ],
  },
  {
    name: "housing-stock",
    displayName: "Housing Stock",
    subCategories: [
      {
        name: "housing-characteristics",
        columns: ["housingunits", "medunitage", "perc_owner_nonlocal"],
      },
      {
        name: "new-project-permitted",
        columns: ["newsfr", "newmfr", "newsfr_5y", "newmfr_5y"],
      },
      {
        name: "permit-processing-time",
        columns: [
          "meddelaysfr",
          "meddelaymfr",
          "meddelaymfr_5y",
          "meddelaysfr_5y",
        ],
      },
      { name: "vacation-rentals", columns: ["tvrunits", "tvrshare"] },
      {
        name: "subsidized-housing",
        columns: ["subsunits", "subsunitsperc"],
      },
    ],
  },
  {
    name: "property-market",
    displayName: "Property Market",
    subCategories: [
      { name: "homeownership", columns: ["owner", "mortgaged"] },
      {
        name: "property-prices",
        columns: [
          "medpricetg_SFR",
          "medpricetg_CND",
          "medpricetg_SFR_index",
          "medpricetg_CND_index",
          "rsi",
        ],
      },
      {
        name: "property-transactions",
        columns: [
          "transactions_SFR",
          "instate_SFR",
          "instate_CND",
          "outofstate_SFR",
          "transactions_CND",
          "outofstate_CND",
        ],
      },
      {
        name: "home-affordability",
        columns: [
          "medownercosts",
          "medownercostasperinc",
          "neededinc_sfr",
          "neededinc_cnd",
        ],
      },
    ],
  },
  {
    name: "rental-market",
    displayName: "Rental Market",
    subCategories: [
      { name: "rental-population", columns: ["renter"] },
      { name: "rents", columns: ["medrent_acs", "medrent_craig"] },
      {
        name: "rental-affordability",
        columns: [
          "neededinc_rent_craig",
          "medrentasperinc",
          "rentburd30",
          "rentburd50",
          "neededinc_rent",
        ],
      },
    ],
  },
  {
    name: "zoning",
    displayName: "Zoning",
    subCategories: [
      { name: "zoning", columns: ["zoning", "popperacre", "mfr_share"] },
    ],
  },
];

// ─── Percent columns (for measurement.percent flag) ──────────────────
const PERCENT_PREFIXES = new Set([
  "ASIAN",
  "WHITE",
  "BLACK",
  "HAWPI",
  "HS",
  "COL",
  "OWNER",
  "RENTER",
  "MORTGAGED",
  "UNEMPLOYMENT",
  "MEDRENTASPERINC",
  "MEDOWNERCOSTASPERINC",
  "RENTBURD30",
  "RENTBURD50",
  "OUTOFSTATE_SFR",
  "OUTOFSTATE_CND",
  "TVRSHARE",
  "MFR_SHARE",
  "RSI",
  "PERC_OWNER_NONLOCAL",
  "SUBSUNITSPERC",
  "JOBS_D30_PERC",
  "JOBS_T30_PERC",
]);

// ─── County mapping ─────────────────────────────────────────────────
const COUNTIES = [
  { fips: "15001", handle: "HAW", displayName: "Hawaii County" },
  { fips: "15003", handle: "HON", displayName: "Honolulu County" },
  { fips: "15007", handle: "KAU", displayName: "Kauai County" },
  { fips: "15009", handle: "MAU", displayName: "Maui County" },
];

// ─── Geography CSV parsing ───────────────────────────────────────────

type GeoRow = {
  zcta5: string;
  countyFips: string;
  zipname: string;
};

async function parseGeoCsv(): Promise<GeoRow[]> {
  const csvPath = path.join(import.meta.dir, "geo-data.csv");
  const text = await readFile(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: GeoRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].match(/(".*?"|[^,]+)/g);
    if (!fields || fields.length < 8) continue;
    const unquote = (s: string) => s.replace(/^"|"$/g, "").trim();
    rows.push({
      zcta5: unquote(fields[1]),
      countyFips: unquote(fields[2]),
      zipname: unquote(fields[5]),
    });
  }
  return rows;
}

// ─── Main seed logic ─────────────────────────────────────────────────

async function seed() {
  console.log(`HHF Universe Seed ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"}`);
  console.log("─".repeat(60));

  const allColumns: string[] = [];
  for (const top of UNIVERSE_STRUCTURE) {
    for (const sub of top.subCategories) {
      allColumns.push(...sub.columns);
    }
  }
  const allPrefixes = allColumns.map(sanitizePrefix);
  console.log(`Total measurements to create: ${allPrefixes.length}`);

  const geoRows = await parseGeoCsv();
  const countyFipsSet = new Set(COUNTIES.map((c) => c.fips));
  const filteredGeoRows = geoRows.filter((r) => countyFipsSet.has(r.countyFips));
  console.log(`ZCTAs from CSV: ${filteredGeoRows.length}`);
  console.log(`Counties: ${COUNTIES.map((c) => c.handle).join(", ")}`);
  console.log("─".repeat(60));

  if (DRY_RUN) {
    console.log("\nCategories:");
    for (const top of UNIVERSE_STRUCTURE) {
      console.log(`  ${top.displayName}`);
      for (const sub of top.subCategories) {
        const prefixes = sub.columns.map(sanitizePrefix);
        console.log(
          `    ${sub.name} (${prefixes.length}): ${prefixes.join(", ")}`,
        );
      }
    }
    console.log(`\nGeographies: 1 state + ${COUNTIES.length} counties + ${filteredGeoRows.length} ZCTAs`);
    console.log(`\nMeasurements: ${allPrefixes.length}`);
    for (const prefix of allPrefixes) {
      const pct = PERCENT_PREFIXES.has(prefix) ? " [percent]" : "";
      console.log(`  ${prefix}${pct}`);
    }
    console.log("\nRun with --execute to create these records.");
    return;
  }

  // ── Step 0: Universe ───────────────────────────────────────────────

  const uniId = await findId("universe", { name: HHF });
  if (!uniId) {
    await rawQuery("INSERT INTO universe (name) VALUES (?)", [HHF]);
    console.log("Inserted HHF into universe table");
  } else {
    console.log("Universe HHF exists");
  }

  // ── Step 1: Root category ─────────────────────────────────────────

  let rootId = await findId("categories", {
    universe: HHF,
    ancestry: null,
  });
  if (!rootId) {
    rootId = await insert(
      `INSERT INTO categories (universe, name, list_order, hidden, masked, header, created_at, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, NOW(), NOW())`,
      [HHF, "HHF"],
    );
    console.log(`Created root category (id=${rootId})`);
  } else {
    console.log(`Root category exists (id=${rootId})`);
  }
  const rootAncestry = String(rootId);

  // ── Step 2: Categories, data lists, measurements ──────────────────

  const measurementByPrefix = new Map<string, number>();

  for (let i = 0; i < UNIVERSE_STRUCTURE.length; i++) {
    const top = UNIVERSE_STRUCTURE[i];

    let topId = await findId("categories", {
      universe: HHF,
      ancestry: rootAncestry,
      name: top.name,
    });
    if (!topId) {
      topId = await insert(
        `INSERT INTO categories (universe, name, ancestry, list_order, hidden, masked, header, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, 1, NOW(), NOW())`,
        [HHF, top.name, rootAncestry, i],
      );
      console.log(`  Created top category "${top.name}" (id=${topId})`);
    } else {
      console.log(`  Top category "${top.name}" exists (id=${topId})`);
    }
    const topAncestry = `${rootAncestry}/${topId}`;

    for (let j = 0; j < top.subCategories.length; j++) {
      const sub = top.subCategories[j];

      // Data list
      let dlId = await findId("data_lists", {
        universe: HHF,
        name: sub.name,
      });
      if (!dlId) {
        dlId = await insert(
          `INSERT INTO data_lists (universe, name, created_at, updated_at)
           VALUES (?, ?, NOW(), NOW())`,
          [HHF, sub.name],
        );
        console.log(`    Created data list "${sub.name}" (id=${dlId})`);
      }

      // Sub-category linked to data list
      let subId = await findId("categories", {
        universe: HHF,
        ancestry: topAncestry,
        name: sub.name,
      });
      if (!subId) {
        subId = await insert(
          `INSERT INTO categories (universe, name, ancestry, list_order, data_list_id, hidden, masked, header, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, 0, NOW(), NOW())`,
          [HHF, sub.name, topAncestry, j, dlId],
        );
        console.log(`    Created sub-category "${sub.name}" (id=${subId})`);
      }

      // Measurements + link to data list
      for (let k = 0; k < sub.columns.length; k++) {
        const rawCol = sub.columns[k];
        const prefix = sanitizePrefix(rawCol);
        const isPercent = PERCENT_PREFIXES.has(prefix);

        if (!measurementByPrefix.has(prefix)) {
          let mId = await findId("measurements", {
            universe: HHF,
            prefix,
          });
          if (!mId) {
            mId = await insert(
              `INSERT INTO measurements (universe, prefix, data_portal_name, decimals, \`percent\`, seasonal_adjustment, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'not_applicable', NOW(), NOW())`,
              [HHF, prefix, rawCol, isPercent ? 1 : 2, isPercent ? 1 : 0],
            );
          }
          measurementByPrefix.set(prefix, mId);
        }

        const mId = measurementByPrefix.get(prefix)!;
        // Link measurement to data list (idempotent)
        const existing = await rawQuery<{ id: number }>(
          `SELECT id FROM data_list_measurements WHERE data_list_id = ? AND measurement_id = ? LIMIT 1`,
          [dlId, mId],
        );
        if (!existing[0]) {
          await rawQuery(
            `INSERT INTO data_list_measurements (data_list_id, measurement_id, list_order, indent)
             VALUES (?, ?, ?, 'indent0')`,
            [dlId, mId, k],
          );
        }
      }
      console.log(
        `    ${sub.name}: ${sub.columns.length} measurements linked`,
      );
    }
  }

  console.log(`  Total measurements: ${measurementByPrefix.size}`);

  // ── Step 3: Geographies ───────────────────────────────────────────

  console.log("\nCreating geographies...");

  // State
  let stateId = await findId("geographies", { universe: HHF, handle: "HI" });
  if (!stateId) {
    stateId = await insert(
      `INSERT INTO geographies (universe, handle, display_name, display_name_short, fips, geotype, list_order, created_at, updated_at)
       VALUES (?, 'HI', 'Hawaii', 'Hawaii', '15', 'state', 0, NOW(), NOW())`,
      [HHF],
    );
    console.log(`  Created state HI (id=${stateId})`);
  } else {
    console.log(`  State HI exists (id=${stateId})`);
  }

  // Counties
  for (let i = 0; i < COUNTIES.length; i++) {
    const c = COUNTIES[i];
    let cId = await findId("geographies", {
      universe: HHF,
      handle: c.handle,
    });
    if (!cId) {
      cId = await insert(
        `INSERT INTO geographies (universe, handle, display_name, display_name_short, fips, geotype, list_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'county', ?, NOW(), NOW())`,
        [HHF, c.handle, c.displayName, c.handle, c.fips, i + 1],
      );
      console.log(`  Created county ${c.handle} (id=${cId})`);
    } else {
      console.log(`  County ${c.handle} exists (id=${cId})`);
    }
  }

  // ZCTAs
  let zctaCreated = 0;
  let zctaExisting = 0;
  for (const row of filteredGeoRows) {
    const existing = await findId("geographies", {
      universe: HHF,
      handle: row.zcta5,
    });
    if (existing) {
      zctaExisting++;
      continue;
    }
    await insert(
      `INSERT INTO geographies (universe, handle, display_name, display_name_short, fips, geotype, list_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'zipcode', ?, NOW(), NOW())`,
      [HHF, row.zcta5, row.zipname, row.zcta5, row.countyFips, 100 + zctaCreated],
    );
    zctaCreated++;
  }
  console.log(`  ZCTAs: ${zctaCreated} created, ${zctaExisting} existing`);

  // ── Summary ───────────────────────────────────────────────────────

  console.log("\n" + "─".repeat(60));
  console.log("HHF Universe Seed complete.");
  console.log(`  Categories: ${UNIVERSE_STRUCTURE.length} top-level + ${UNIVERSE_STRUCTURE.reduce((n, t) => n + t.subCategories.length, 0)} sub`);
  console.log(`  Measurements: ${measurementByPrefix.size}`);
  console.log(`  Geographies: 1 state + ${COUNTIES.length} counties + ${zctaCreated + zctaExisting} ZCTAs`);
}

seed()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nSEED FAILED:", err);
    process.exit(1);
  });
