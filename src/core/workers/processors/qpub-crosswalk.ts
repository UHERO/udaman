/**
 * QPub Crosswalk — census geography for every parcel.
 *
 * The parcel/ZCTA/tract crosswalk is built off the State's statewide parcel
 * layer: one row per land parcel with its centroid, the 2020 ZIP Code
 * Tabulation Area it falls in, and the census-tract FIPS keys. This loads it
 * into parcel_crosswalk (remote-only, survives a rebuild) and mirrors the
 * useful columns onto properties for convenient joins.
 *
 * The crosswalk is a land layer with no CPR/condo units, so condo units take
 * their parent parcel's values — the same treatment `qpub parcel-list` gives
 * membership.
 *
 * Dry run unless --execute.
 */

import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { createInterface } from "readline";

import { QPUB_CONFIG } from "@/core/crawlers/qpub/config";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

const log = createLogger("qpub-crosswalk");

// ─── Constants ──────────────────────────────────────────────────────

const UPSERT_CHUNK_SIZE = 1_000;
const REPORT_DIR = "tmp";

/** The crosswalk lives beside the statewide parcel list, html/ and json/. */
const CROSSWALK_FILENAME = "hawaii_parcel_zcta_tract_crosswalk.csv";

/** Columns we read. Looked up by name, not position. */
const REQUIRED_COLUMNS = [
  "division",
  "zone",
  "section",
  "plat1",
  "parcel1",
  "GISAcres",
  "centroid_lat",
  "centroid_lon",
  "zcta_ZCTA5CE20",
  "tract_COUNTYFP",
  "tract_TRACTCE",
  "tract_GEOID",
] as const;

// ─── Types ──────────────────────────────────────────────────────────

export type CrosswalkOptions = {
  /** CSV path. Defaults to the crosswalk on the NAS. */
  file?: string;
  /** Apply changes. Without it nothing is written. */
  execute?: boolean;
  /**
   * Skip the CSV entirely and re-mirror parcel_crosswalk onto properties.
   * For use after a rebuild, which recreates properties without the values.
   */
  propertiesOnly?: boolean;
};

type CrosswalkRow = {
  parcelTmk: string;
  acres: number;
  latitude: number;
  longitude: number;
  zcta20: string | null;
  countyfp: string;
  tractce: string;
  tractGeoid: string;
};

// ─── CSV ────────────────────────────────────────────────────────────

function defaultCrosswalkFile(): string {
  // Beside html/ and json/ — their shared parent, derived from HTML_DIR so
  // the "qpub" segment isn't spelled out twice.
  const dir = path.dirname(
    path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.HTML_DIR),
  );
  return path.join(dir, CROSSWALK_FILENAME);
}

/**
 * Stream the CSV into one row per land parcel.
 *
 * ~384k rows / 195 MB, so it's read line by line rather than loaded. The
 * export has no quoted fields (verified: no double quotes anywhere, every
 * line has the same field count), so a plain split is safe.
 *
 * A TMK can appear more than once when a parcel's geometry is stored as
 * several disjoint pieces (tmk_dup_count > 1). Most of those are
 * placeholders that resolve to no parcel profile; when a real one is among
 * them the largest piece is the parcel, so the row with the greatest
 * GISAcres wins.
 */
async function readCrosswalk(file: string): Promise<{
  rows: Map<string, CrosswalkRow>;
  read: number;
  malformed: number;
  duplicates: number;
}> {
  const rows = new Map<string, CrosswalkRow>();
  let read = 0;
  let malformed = 0;
  let duplicates = 0;
  let columns: Record<string, number> | null = null;

  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!columns) {
      const names = line.replace(/^\uFEFF/, "").split(",");
      columns = Object.fromEntries(names.map((n, i) => [n.trim(), i]));
      const missing = REQUIRED_COLUMNS.filter((c) => !(c in columns!));
      if (missing.length > 0) {
        throw new Error(
          `${path.basename(file)} is missing expected column(s): ${missing.join(", ")}`,
        );
      }
      continue;
    }

    const f = line.split(",");
    const get = (name: (typeof REQUIRED_COLUMNS)[number]) =>
      (f[columns![name]] ?? "").trim();

    const division = get("division");
    const zone = get("zone");
    const section = get("section");
    const plat = get("plat1");
    const parcel = get("parcel1");
    const acres = Number(get("GISAcres"));
    const latitude = Number(get("centroid_lat"));
    const longitude = Number(get("centroid_lon"));
    const zcta = get("zcta_ZCTA5CE20");
    const countyfp = get("tract_COUNTYFP");
    const tractce = get("tract_TRACTCE");
    const tractGeoid = get("tract_GEOID");

    const wellFormed =
      /^[1-4]$/.test(division) &&
      /^\d$/.test(zone) &&
      /^\d$/.test(section) &&
      /^\d{3}$/.test(plat) &&
      /^\d{3}$/.test(parcel) &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      (zcta === "" || /^\d{5}$/.test(zcta)) &&
      /^\d{3}$/.test(countyfp) &&
      /^\d{6}$/.test(tractce) &&
      /^\d{11}$/.test(tractGeoid);

    if (!wellFormed) {
      malformed++;
      continue;
    }

    read++;
    const row: CrosswalkRow = {
      // division is the leading TMK digit (1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai);
      // plat1/parcel1 are the zero-padded variants of plat/parcel.
      parcelTmk: `${division}-${zone}-${section}-${plat}-${parcel}`,
      acres: Number.isFinite(acres) ? acres : 0,
      latitude,
      longitude,
      zcta20: zcta || null,
      countyfp,
      tractce,
      tractGeoid,
    };

    const existing = rows.get(row.parcelTmk);
    if (existing) {
      duplicates++;
      if (row.acres > existing.acres) rows.set(row.parcelTmk, row);
    } else {
      rows.set(row.parcelTmk, row);
    }
  }

  return { rows, read, malformed, duplicates };
}

// ─── Writes ─────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

async function upsertCrosswalk(
  rows: CrosswalkRow[],
  sourceFile: string,
): Promise<number> {
  let affected = 0;

  for (const batch of chunk(rows, UPSERT_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,NOW())").join(",");
    const params: (string | number | null)[] = [];
    for (const r of batch) {
      params.push(
        r.parcelTmk,
        r.latitude,
        r.longitude,
        r.zcta20,
        r.countyfp,
        r.tractce,
        r.tractGeoid,
        sourceFile,
      );
    }
    const result = (await rawQuery(
      `INSERT INTO parcel_crosswalk
         (parcel_tmk, latitude, longitude, zcta20, countyfp, tractce, tract_geoid, source_file, loaded_at)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         zcta20 = VALUES(zcta20),
         countyfp = VALUES(countyfp),
         tractce = VALUES(tractce),
         tract_geoid = VALUES(tract_geoid),
         source_file = VALUES(source_file),
         loaded_at = VALUES(loaded_at)`,
      params,
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

/**
 * Copy the geography from parcel_crosswalk onto properties.
 *
 * properties is rebuilt from JSONL and dumped over the remote table, so it
 * loses these columns' values on every sync — parcel_crosswalk is remote-only
 * and survives, which makes it the side worth trusting.
 *
 * Joins on the land parcel (the first five TMK segments) so condo units pick
 * up their parent's values. Rows already matching are left alone so
 * updated_at only moves when something changed.
 */
async function mirrorToProperties(): Promise<number> {
  const result = (await rawQuery(
    `UPDATE properties p
       JOIN parcel_crosswalk c ON c.parcel_tmk = SUBSTRING_INDEX(p.tmk, '-', 5)
        SET p.latitude = c.latitude,
            p.longitude = c.longitude,
            p.zcta20 = c.zcta20,
            p.countyfp = c.countyfp,
            p.tractce = c.tractce,
            p.tract_geoid = c.tract_geoid
      WHERE NOT (p.latitude <=> c.latitude
             AND p.longitude <=> c.longitude
             AND p.zcta20 <=> c.zcta20
             AND p.countyfp <=> c.countyfp
             AND p.tractce <=> c.tractce
             AND p.tract_geoid <=> c.tract_geoid)`,
  )) as unknown as { affectedRows?: number };

  return result?.affectedRows ?? 0;
}

// ─── Reporting ──────────────────────────────────────────────────────

async function writeList(name: string, lines: string[]): Promise<string> {
  const file = path.join(REPORT_DIR, name);
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(file, lines.join("\n") + (lines.length ? "\n" : ""));
  return file;
}

function byIsland(tmks: string[]): string {
  const counts: Record<string, number> = {};
  for (const t of tmks) {
    const island = t.split("-")[0];
    counts[island] = (counts[island] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort()
    .map(([i, n]) => `${i}:${n.toLocaleString()}`)
    .join("  ");
}

// ─── Entry point ────────────────────────────────────────────────────

export async function runCrosswalk(
  opts: CrosswalkOptions = {},
): Promise<string> {
  const { execute = false, propertiesOnly = false } = opts;
  const startMs = Date.now();

  if (propertiesOnly) {
    if (!execute) {
      const msg =
        "Crosswalk (dry run): --properties-only would mirror parcel_crosswalk onto properties. Re-run with --execute.";
      console.log(`\n${msg}\n`);
      return msg;
    }
    const mirrored = await mirrorToProperties();
    const summary = `Crosswalk: mirrored geography onto ${mirrored.toLocaleString()} properties rows`;
    log.info(summary);
    console.log(`\n${summary}\n`);
    return summary;
  }

  const file = opts.file ?? defaultCrosswalkFile();
  const sourceFile = path.basename(file);

  log.info(
    { file, execute },
    execute ? "Crosswalk load started (EXECUTE)" : "Crosswalk load started (dry run)",
  );

  // 1. The crosswalk
  const { rows, read, malformed, duplicates } = await readCrosswalk(file);
  log.info(
    { read, unique: rows.size, malformed, duplicates },
    `Read ${read.toLocaleString()} crosswalk rows (${rows.size.toLocaleString()} unique parcels)`,
  );

  // 2. Our land parcels — condo units collapse onto their parent
  const ourRows = await rawQuery<{ parcel: string }>(
    `SELECT DISTINCT SUBSTRING_INDEX(tmk, '-', 5) AS parcel FROM properties`,
  );
  const ours = ourRows.map((r) => r.parcel);

  // 3. Compare both directions
  const matched = ours.filter((p) => rows.has(p));
  const unmatched = ours.filter((p) => !rows.has(p));
  const ourSet = new Set(ours);
  const crosswalkOnly = Array.from(rows.keys()).filter((p) => !ourSet.has(p));

  let noZcta = 0;
  for (const r of rows.values()) if (r.zcta20 === null) noZcta++;

  // 4. Report
  console.log(`
─── QPub crosswalk — ${sourceFile} ───

Crosswalk            ${read.toLocaleString()} rows → ${rows.size.toLocaleString()} unique parcels${malformed ? ` (${malformed} malformed rows skipped)` : ""}${duplicates ? ` (${duplicates} duplicate rows collapsed, largest area kept)` : ""}
  without a ZCTA     ${noZcta.toLocaleString()}
Our land parcels     ${ours.length.toLocaleString()}

Matched              ${matched.length.toLocaleString()}   → geography stamped (condo units inherit)
Not in crosswalk     ${unmatched.length.toLocaleString()}   by island  ${byIsland(unmatched)}
In crosswalk, not ours ${crosswalkOnly.length.toLocaleString()}   (loaded into parcel_crosswalk, reported only)
`);

  const unmatchedFile = await writeList(
    `qpub-crosswalk-unmatched.txt`,
    unmatched,
  );
  const crosswalkOnlyFile = await writeList(
    `qpub-crosswalk-not-in-our-list.txt`,
    crosswalkOnly,
  );
  console.log(`Parcels not in crosswalk  ${unmatchedFile}`);
  console.log(`Parcels we don't have     ${crosswalkOnlyFile}`);
  if (unmatched.length > 0) {
    console.log(`\nSample of parcels not in the crosswalk:`);
    for (const t of unmatched.slice(0, 10)) console.log(`  ${t}`);
  }

  if (!execute) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const summary = `Crosswalk (dry run): ${matched.length} parcels matched, ${unmatched.length} not in the crosswalk, ${crosswalkOnly.length} parcels we don't have (${elapsed}s). Re-run with --execute to apply.`;
    console.log(`\n${summary}\n`);
    log.info(summary);
    return summary;
  }

  // 5. Load parcel_crosswalk, then mirror onto properties
  const upserted = await upsertCrosswalk(Array.from(rows.values()), sourceFile);
  log.info({ affected: upserted }, "Upserted parcel_crosswalk");

  const mirrored = await mirrorToProperties();
  log.info({ rows: mirrored }, "Mirrored geography onto properties");

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary =
    `Crosswalk ${sourceFile}: ${rows.size.toLocaleString()} parcels loaded, ` +
    `${mirrored.toLocaleString()} properties rows mirrored, ` +
    `${unmatched.length.toLocaleString()} of our parcels not in the crosswalk (${elapsed}s)`;
  console.log(`\n${summary}\n`);
  log.info(summary);
  return summary;
}
