/**
 * QPub Parcel List — reconcile our TMKs against the State's parcel list.
 *
 * The scrape is driven by a TMK list we accumulated; the State publishes the
 * authoritative statewide parcel layer periodically. The two drift: parcels
 * get consolidated, split, or renumbered, and our list carries TMKs that were
 * never really parcels (roads, infrastructure, retired numbers).
 *
 * Nothing is deleted. This records membership as a flag so those rows can be
 * excluded from reporting — or from the scrape queue — by choice rather than
 * by guesswork, and surfaces parcels the State has that we don't.
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

import { enqueueTmks } from "./qpub-enqueue";

const log = createLogger("qpub-parcel-list");

// ─── Constants ──────────────────────────────────────────────────────

const UPDATE_CHUNK_SIZE = 5_000;
const REPORT_DIR = "tmp";

/** Statewide extracts land here, beside html/ and json/. */
const PARCEL_LIST_GLOB = /_Parcels_-_Hawaii_Statewide\.csv$/i;

/** Leading vintage in the filename, e.g. "2026-8_Parcels_-_...csv" → "2026-8". */
const VERSION_RE = /^(\d{4}-\d{1,2})_/;

/** Columns the derived TMK is built from. Looked up by name, not position. */
const REQUIRED_COLUMNS = [
  "division",
  "zone",
  "section",
  "plat1",
  "parcel1",
] as const;

// ─── Types ──────────────────────────────────────────────────────────

export type ParcelListOptions = {
  /** CSV path. Defaults to the newest statewide extract on the NAS. */
  file?: string;
  /** Apply changes. Without it nothing is written. */
  execute?: boolean;
  /**
   * Skip the CSV entirely and re-mirror scrape_status onto properties.
   * For use after a rebuild, which recreates properties without the flags.
   */
  propertiesOnly?: boolean;
  /** Queue parcels the State lists that we have no row for. */
  addNew?: boolean;
};

type Membership = { active: string[]; absent: string[] };

// ─── CSV ────────────────────────────────────────────────────────────

/** Newest statewide extract sitting beside the scrape directories. */
async function findParcelListFile(): Promise<string> {
  // The extract lives alongside html/ and json/ — i.e. their shared parent,
  // derived from HTML_DIR so the "qpub" segment isn't spelled out twice.
  const dir = path.dirname(
    path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.HTML_DIR),
  );
  const entries = await fs.readdir(dir);
  const matches = entries.filter((e) => PARCEL_LIST_GLOB.test(e)).sort();

  if (matches.length === 0) {
    throw new Error(
      `No *_Parcels_-_Hawaii_Statewide.csv found in ${dir} — is the share mounted?`,
    );
  }

  // Filenames lead with the vintage, so the last one sorted is the newest.
  return path.join(dir, matches[matches.length - 1]);
}

function versionFromFilename(file: string): string {
  return path.basename(file).match(VERSION_RE)?.[1] ?? "unknown";
}

/**
 * Stream the CSV into the set of TMKs it asserts exist.
 *
 * The list is ~380k rows / 80 MB, so it's read line by line rather than
 * loaded. Every row is a land parcel — the layer has no CPR/condo units — so
 * each derived TMK ends in the 0000 suffix and condo units are matched
 * against their parent parcel later.
 */
async function readParcelList(file: string): Promise<{
  tmks: Set<string>;
  rows: number;
  malformed: number;
}> {
  const tmks = new Set<string>();
  let rows = 0;
  let malformed = 0;
  let columns: Record<string, number> | null = null;

  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!columns) {
      // The export is UTF-8 with a BOM, which would otherwise ride along on
      // the first column name and break the lookup.
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
    const division = f[columns.division];
    const zone = f[columns.zone];
    const section = f[columns.section];
    const plat = f[columns.plat1];
    const parcel = f[columns.parcel1];

    if (!division || !zone || !section || !plat || !parcel) {
      malformed++;
      continue;
    }

    rows++;
    // division is the leading TMK digit (1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai);
    // plat1/parcel1 are the zero-padded variants of plat/parcel.
    tmks.add(`${division}-${zone}-${section}-${plat}-${parcel}-0000`);
  }

  return { tmks, rows, malformed };
}

// ─── Membership ─────────────────────────────────────────────────────

/** The land parcel a TMK belongs to — itself, unless it's a CPR unit. */
function parentParcel(tmk: string): string {
  const p = tmk.split("-");
  return `${p[0]}-${p[1]}-${p[2]}-${p[3]}-${p[4]}-0000`;
}

/**
 * Split our TMKs by whether the State still lists them.
 *
 * Condo units inherit their parent parcel's membership: the statewide layer
 * is a land layer, so no CPR unit appears in it by name. Matching them
 * literally would call every condo in the state absent.
 */
function classifyMembership(
  ours: string[],
  authoritative: Set<string>,
): Membership {
  const active: string[] = [];
  const absent: string[] = [];

  for (const tmk of ours) {
    if (authoritative.has(parentParcel(tmk))) active.push(tmk);
    else absent.push(tmk);
  }

  return { active, absent };
}

// ─── Writes ─────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

async function stampMembership(
  tmks: string[],
  inList: 0 | 1,
  version: string,
): Promise<number> {
  let affected = 0;

  for (const batch of chunk(tmks, UPDATE_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "?").join(",");
    const result = (await rawQuery(
      `UPDATE scrape_status
       SET in_parcel_list = ?, parcel_list_version = ?, parcel_list_checked_at = NOW()
       WHERE tmk IN (${placeholders})`,
      [inList, version, ...batch],
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

/**
 * Copy the flags from scrape_status onto properties.
 *
 * properties is rebuilt from JSONL and dumped over the remote table, so it
 * loses these columns' values on every sync — scrape_status is remote-only and
 * survives, which makes it the side worth trusting.
 */
async function mirrorToProperties(): Promise<number> {
  const result = (await rawQuery(
    `UPDATE properties p
       JOIN scrape_status s ON s.tmk = p.tmk
        SET p.in_parcel_list = s.in_parcel_list,
            p.parcel_list_version = s.parcel_list_version,
            p.parcel_list_checked_at = s.parcel_list_checked_at
      WHERE s.in_parcel_list IS NOT NULL
        AND (p.in_parcel_list IS NULL
             OR p.in_parcel_list <> s.in_parcel_list
             OR p.parcel_list_version IS NULL
             OR p.parcel_list_version <> s.parcel_list_version)`,
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

export async function runParcelList(
  opts: ParcelListOptions = {},
): Promise<string> {
  const { execute = false, propertiesOnly = false, addNew = false } = opts;
  const startMs = Date.now();

  if (propertiesOnly) {
    if (!execute) {
      const msg =
        "Parcel list (dry run): --properties-only would mirror scrape_status flags onto properties. Re-run with --execute.";
      console.log(`\n${msg}\n`);
      return msg;
    }
    const mirrored = await mirrorToProperties();
    const summary = `Parcel list: mirrored flags onto ${mirrored.toLocaleString()} properties rows`;
    log.info(summary);
    console.log(`\n${summary}\n`);
    return summary;
  }

  const file = opts.file ?? (await findParcelListFile());
  const version = versionFromFilename(file);

  log.info(
    { file, version, execute },
    execute
      ? "Parcel list reconciliation started (EXECUTE)"
      : "Parcel list reconciliation started (dry run)",
  );

  // 1. The State's view
  const { tmks: authoritative, rows, malformed } = await readParcelList(file);
  log.info(
    { rows, unique: authoritative.size, malformed },
    `Read ${rows.toLocaleString()} parcels (${authoritative.size.toLocaleString()} unique TMKs)`,
  );

  // 2. Ours
  const ourRows = await rawQuery<{ tmk: string }>(
    `SELECT tmk FROM scrape_status`,
  );
  const ours = ourRows.map((r) => r.tmk);

  // 3. Compare both directions
  const { active, absent } = classifyMembership(ours, authoritative);

  const ourParcels = new Set(ours.map(parentParcel));
  const unlisted = Array.from(authoritative).filter((t) => !ourParcels.has(t));

  const absentBase = absent.filter((t) => t.endsWith("-0000"));
  const absentCpr = absent.length - absentBase.length;

  // 4. Report
  console.log(`
─── QPub parcel list — ${path.basename(file)} (version ${version}) ───

State list           ${rows.toLocaleString()} rows → ${authoritative.size.toLocaleString()} unique parcels${malformed ? ` (${malformed} malformed rows skipped)` : ""}
Our scrape_status    ${ours.length.toLocaleString()} TMKs

In the list          ${active.length.toLocaleString()}   → in_parcel_list = 1
Not in the list      ${absent.length.toLocaleString()}   → in_parcel_list = 0
  land parcels       ${absentBase.length.toLocaleString()}   by island  ${byIsland(absentBase)}
  condo/CPR units    ${absentCpr.toLocaleString()}   (parent parcel is absent)

In the list, not ours ${unlisted.length.toLocaleString()}   → ${addNew ? "queued for scraping" : "reported only (pass --add-new to queue them)"}
`);

  const absentFile = await writeList(
    `qpub-parcel-list-${version}-absent.txt`,
    absent,
  );
  const unlistedFile = await writeList(
    `qpub-parcel-list-${version}-not-in-our-list.txt`,
    unlisted,
  );
  console.log(`Absent TMKs           ${absentFile}`);
  console.log(`Parcels we don't have ${unlistedFile}`);
  if (absentBase.length > 0) {
    console.log(`\nSample of absent land parcels:`);
    for (const t of absentBase.slice(0, 10)) console.log(`  ${t}`);
  }

  if (!execute) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const summary = `Parcel list (dry run): ${active.length} in the list, ${absent.length} absent, ${unlisted.length} parcels we don't have (${elapsed}s). Re-run with --execute to apply.`;
    console.log(`\n${summary}\n`);
    log.info(summary);
    return summary;
  }

  // 5. Queue parcels the State has and we don't, before stamping — so they're
  //    picked up by the same run's in_parcel_list = 1 pass.
  let queued = 0;
  if (addNew && unlisted.length > 0) {
    const result = await enqueueTmks(
      unlisted.map((tmk) => ({ tmk, islandCode: tmk.split("-")[0] })),
      `state parcel list ${version}`,
    );
    queued = result.queued;
    active.push(...unlisted);
    log.info(
      { queued, stubProperties: result.properties },
      `Queued ${queued.toLocaleString()} parcels new to us`,
    );
  }

  // 6. Stamp scrape_status, then mirror onto properties
  const activeStamped = await stampMembership(active, 1, version);
  const absentStamped = await stampMembership(absent, 0, version);
  log.info(
    { active: activeStamped, absent: absentStamped },
    "Stamped scrape_status",
  );

  const mirrored = await mirrorToProperties();
  log.info({ rows: mirrored }, "Mirrored flags onto properties");

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary =
    `Parcel list ${version}: ${activeStamped.toLocaleString()} marked in-list, ` +
    `${absentStamped.toLocaleString()} marked absent, ` +
    `${mirrored.toLocaleString()} properties rows mirrored, ` +
    `${unlisted.length.toLocaleString()} parcels we don't have` +
    `${addNew ? ` (${queued.toLocaleString()} queued)` : ""} (${elapsed}s)`;
  console.log(`\n${summary}\n`);
  log.info(summary);
  return summary;
}
