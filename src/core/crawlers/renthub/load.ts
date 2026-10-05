/**
 * Load the Hawaii file of every RentHub delivery on the NAS into
 * renthub_listings.
 *
 *   <root>/<start>_<end>/HI.csv.gz   (one directory per delivery = "batch")
 *
 * Only HI is read; the other states' files (~125 GB in all) are never opened.
 * A batch is skipped when renthub_loads already records it with the same file
 * size, so a rerun picks up new deliveries only. A crash mid-batch leaves no
 * renthub_loads row, so the next run redoes that batch; the upsert keyed on
 * the vendor id makes that safe.
 *
 * Each row is geocoded to a parcel TMK before it is written (geocode.ts):
 * the parcel its latitude / longitude falls in on the statewide TMK polygon
 * layer, corrected by matching its street address against the qPublic site
 * addresses of nearby parcels (properties.location_address). To re-geocode
 * after the layer or properties change, rerun with --force.
 */

import { existsSync, readdirSync, statSync } from "fs";
import path from "path";

import { toHstSql } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";
import { rawQuery, transaction } from "@/lib/mysql/hhdb";
import { localRawQuery, localTransaction } from "@/lib/mysql/hhdb-local";

import { AddressIndex, type Db } from "../address";
import { parseCsv } from "../csv";
import { refreshFreqTables, type Tx } from "../freq-refresh";
import { resilient } from "../mls/db-retry";
import {
  chunkByBytes,
  maxAllowedPacket,
  rowBudget,
  valueBytes,
} from "../packet";
import {
  colIndex,
  mapHeader,
  parseRecord,
  RENTHUB_COLUMNS,
  RENTHUB_INSERT_COLUMNS,
  RenthubParseError,
  type SqlValue,
} from "./columns";
import { geocode, TMK_MATCHES, type TmkMatch } from "./geocode";
import { DEFAULT_PARCELS_PATH, ParcelIndex } from "./parcels";

const log = createLogger("renthub");

export const DEFAULT_RENTHUB_ROOT =
  "/Volumes/UHEROroot/datashare/renthub/rawdata";

const STATE = "HI";
/** Delivery directory name: <start>_<end>, both ISO dates. */
const BATCH_DIR = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/;

/**
 * How far outside every parcel a point may sit and still take the nearest
 * one. Off by default: 4% of points are outside every parcel (median 4 m from
 * an edge — geocodes dropped in the street), and checked against qPublic
 * site addresses only ~19% of those nearest parcels had the listing's house
 * number, vs ~90% for points inside a parcel. The nearest edge is as often
 * the lot across the road. --max-nearest 50 opts in; rows stay flagged.
 */
export const DEFAULT_MAX_NEAREST_M = 0;

/**
 * How far from the point to look for a parcel carrying the listing's
 * address. Widened automatically for coarse coordinates (searchRadiusM).
 */
export const DEFAULT_ADDRESS_RADIUS_M = 300;

export type { Db } from "../address";

export interface RenthubBatch {
  batch: string;
  file: string;
  bytes: number;
}

export interface RenthubOptions {
  /** Delivery root; default $RENTHUB_RAW_PATH or the NAS path. */
  root?: string;
  /** Only these batches (directory names). */
  batches?: string[];
  /** Reload batches renthub_loads already records. */
  force?: boolean;
  /** Parse and validate every file, write nothing. */
  dryRun?: boolean;
  /** Write to the local rebuild DB instead of the remote housing DB. */
  local?: boolean;
  /** TMK polygon layer; default $RENTHUB_PARCELS_PATH or the NAS path. */
  parcels?: string;
  /** Nearest-parcel cutoff in metres for points inside no parcel. */
  maxNearestM?: number;
  /** Address search radius in metres; 0 skips address matching (and the properties read). */
  addressRadiusM?: number;
  /** Prebuilt parcel index (tests); otherwise built from `parcels` on first use. */
  parcelIndex?: ParcelIndex;
  /** Prebuilt address index (tests); otherwise read from properties on first use. */
  addressIndex?: AddressIndex;
  shouldStop?: () => boolean;
  db?: Db;
  /** Transaction runner (tests); defaults to the target DB's. */
  tx?: Tx;
}

export interface RenthubBatchResult {
  batch: string;
  file: string;
  status: "loaded" | "skipped" | "parsed";
  rows: number;
  geocode?: GeocodeCounts;
  /** MySQL affectedRows summed: 1 per insert, 2 per changed update, 0 unchanged. */
  affectedRows?: number;
  ms?: number;
}

export function resolveRoot(root?: string): string {
  return (
    root?.trim() || process.env.RENTHUB_RAW_PATH?.trim() || DEFAULT_RENTHUB_ROOT
  );
}

export function resolveParcelsPath(parcels?: string): string {
  return (
    parcels?.trim() ||
    process.env.RENTHUB_PARCELS_PATH?.trim() ||
    DEFAULT_PARCELS_PATH
  );
}

/**
 * Every delivery directory that holds a Hawaii file, oldest first. Prefers the
 * delivered HI.csv.gz over an HI.csv someone unzipped next to it.
 */
export function discoverBatches(root: string): RenthubBatch[] {
  if (!existsSync(root))
    throw new Error(`RentHub root not found: ${root} (is the NAS mounted?)`);
  const out: RenthubBatch[] = [];
  for (const name of readdirSync(root).sort()) {
    if (!BATCH_DIR.test(name)) continue;
    const file = [`${STATE}.csv.gz`, `${STATE}.csv`]
      .map((f) => path.join(root, name, f))
      .find((f) => existsSync(f));
    if (!file) {
      log.warn({ batch: name }, `no ${STATE} file in delivery`);
      continue;
    }
    out.push({ batch: name, file, bytes: statSync(file).size });
  }
  return out;
}

/** Read one batch file and parse every record. Throws on any bad value. */
export async function readBatch(b: RenthubBatch): Promise<SqlValue[][]> {
  let bytes = new Uint8Array(await Bun.file(b.file).arrayBuffer());
  if (b.file.endsWith(".gz")) bytes = Bun.gunzipSync(bytes);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const [header, ...records] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!header) throw new Error(`${b.file}: empty file`);
  try {
    const index = mapHeader(header);
    return records.map((r, i) => {
      try {
        return parseRecord(r, index, b.batch);
      } catch (err) {
        if (err instanceof RenthubParseError)
          throw new RenthubParseError(`record ${i + 1}: ${err.message}`);
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof RenthubParseError)
      throw new RenthubParseError(`${b.file}: ${err.message}`);
    throw err;
  }
}

/** Columns freq_renthub_listings counts by year. */
const RENTHUB_DATE_COLUMNS: ReadonlySet<string> = new Set(
  RENTHUB_COLUMNS.filter((c) => c.kind === "date" || c.kind === "datetime").map(
    (c) => c.column,
  ),
);

export type GeocodeCounts = Record<TmkMatch | "unmatched", number>;

const emptyCounts = (): GeocodeCounts =>
  Object.fromEntries(
    [...TMK_MATCHES, "unmatched"].map((k) => [k, 0]),
  ) as GeocodeCounts;

const LAT = colIndex("latitude");
const LON = colIndex("longitude");
const TMK = colIndex("tmk");
const TMK_MATCH = colIndex("tmk_match");
const TMK_DISTANCE = colIndex("tmk_distance_m");
const TMK_ADDRESS = colIndex("tmk_address");
const ADDRESS = colIndex("address");
const COORD_DECIMALS = colIndex("coord_decimals");

/** Fill the tmk columns of parsed rows in place. */
export function geocodeRows(
  rows: SqlValue[][],
  parcels: ParcelIndex,
  addresses: AddressIndex | null,
  opts: { maxNearestM: number; addressRadiusM: number },
): GeocodeCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    const hit =
      row[LAT] === null || row[LON] === null
        ? null
        : geocode(
            Number(row[LAT]),
            Number(row[LON]),
            row[ADDRESS] as string | null,
            row[COORD_DECIMALS] as number | null,
            parcels,
            addresses,
            opts,
          );
    row[TMK] = hit?.tmk ?? null;
    row[TMK_MATCH] = hit?.match ?? null;
    row[TMK_DISTANCE] = hit ? Math.round(hit.distanceM * 10) / 10 : null;
    row[TMK_ADDRESS] = hit?.address ?? null;
    counts[hit?.match ?? "unmatched"]++;
  }
  return counts;
}

const quote = (c: string) => `\`${c}\``;

/**
 * On a repeated id the NEWER batch wins wholesale: every column but id and
 * batch (geocode included) is guarded by `VALUES(batch) >= batch`, and `batch` itself is assigned last so
 * the guards still see the stored value (MySQL applies the assignments left
 * to right). Reloading an old batch with --force therefore never overwrites
 * rows a later delivery re-shipped — e.g. the unit / property ids that only
 * the 2023-07-28 file carries for the 2023 backfill rows.
 */
const UPSERT_TAIL =
  " ON DUPLICATE KEY UPDATE " +
  [
    ...RENTHUB_INSERT_COLUMNS.filter((c) => c !== "id" && c !== "batch").map(
      (c) =>
        `${quote(c)} = IF(VALUES(\`batch\`) >= \`batch\`, VALUES(${quote(c)}), ${quote(c)})`,
    ),
    "`batch` = GREATEST(`batch`, VALUES(`batch`))",
  ].join(", ");

const ROW_PLACEHOLDERS = `(${RENTHUB_INSERT_COLUMNS.map(() => "?").join(", ")})`;

export function upsertSql(rowCount: number): string {
  return (
    `INSERT INTO renthub_listings (${RENTHUB_INSERT_COLUMNS.map(quote).join(", ")}) VALUES ` +
    Array(rowCount).fill(ROW_PLACEHOLDERS).join(", ") +
    UPSERT_TAIL
  );
}

/** Split rows into INSERT-sized chunks by count and by text size. */
/** Split rows into INSERT statements that fit the packet budget. */
export function chunkRows(rows: SqlValue[][], budget: number): SqlValue[][][] {
  return chunkByBytes(
    rows,
    (row) => row.reduce<number>((n, v) => n + valueBytes(v), 0),
    budget,
  );
}

async function upsertChunk(db: Db, rows: SqlValue[][]): Promise<number> {
  const result = (await db(upsertSql(rows.length), rows.flat())) as unknown as {
    affectedRows?: number;
  };
  return result.affectedRows ?? 0;
}

async function loadedBatches(db: Db): Promise<Map<string, number>> {
  const rows = await db<{ batch: string; file_bytes: number }>(
    "SELECT batch, file_bytes FROM renthub_loads",
  );
  return new Map(rows.map((r) => [r.batch, Number(r.file_bytes)]));
}

async function recordLoad(
  db: Db,
  b: RenthubBatch,
  rows: number,
  geo: GeocodeCounts,
  parcelLayer: string,
): Promise<void> {
  await db(
    `INSERT INTO renthub_loads (batch, file_name, file_bytes, rows_in_file,
       rows_within_addr, rows_address, rows_fuzzy, rows_address_far, rows_within,
       rows_nearest, rows_unmatched, parcel_layer, loaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_bytes = VALUES(file_bytes),
       rows_in_file = VALUES(rows_in_file), rows_within_addr = VALUES(rows_within_addr),
       rows_address = VALUES(rows_address), rows_fuzzy = VALUES(rows_fuzzy),
       rows_address_far = VALUES(rows_address_far),
       rows_within = VALUES(rows_within), rows_nearest = VALUES(rows_nearest),
       rows_unmatched = VALUES(rows_unmatched), parcel_layer = VALUES(parcel_layer),
       loaded_at = VALUES(loaded_at)`,
    [
      b.batch,
      path.basename(b.file),
      b.bytes,
      rows,
      geo.within_addr,
      geo.address,
      geo.fuzzy,
      geo.address_far,
      geo.within,
      geo.nearest,
      geo.unmatched,
      parcelLayer,
      toHstSql(new Date()).slice(0, 19),
    ],
  );
}

/** Batches on disk, with what renthub_loads says about each. */
export async function list(opts: RenthubOptions = {}) {
  const db = opts.db ?? (opts.local ? (localRawQuery as Db) : (rawQuery as Db));
  const batches = discoverBatches(resolveRoot(opts.root));
  const loaded = await loadedBatches(db);
  return batches.map((b) => ({
    batch: b.batch,
    file: path.basename(b.file),
    bytes: b.bytes,
    loaded: !loaded.has(b.batch)
      ? "no"
      : loaded.get(b.batch) === b.bytes
        ? "yes"
        : "stale (file size changed)",
  }));
}

export async function load(opts: RenthubOptions = {}) {
  const db = opts.db ?? (opts.local ? (localRawQuery as Db) : (rawQuery as Db));
  const query = resilient("renthub", db) as Db;
  const root = resolveRoot(opts.root);
  let batches = discoverBatches(root);
  if (opts.batches?.length) {
    const want = new Set(opts.batches);
    const unknown = [...want].filter(
      (b) => !batches.some((x) => x.batch === b),
    );
    if (unknown.length)
      throw new Error(`no such batch under ${root}: ${unknown.join(", ")}`);
    batches = batches.filter((b) => want.has(b.batch));
  }
  const loaded =
    opts.dryRun || opts.force ? new Map() : await loadedBatches(query);
  const parcelsPath = resolveParcelsPath(opts.parcels);
  const geoOpts = {
    maxNearestM: opts.maxNearestM ?? DEFAULT_MAX_NEAREST_M,
    addressRadiusM: opts.addressRadiusM ?? DEFAULT_ADDRESS_RADIUS_M,
  };
  // Built on first use: a run with nothing new to load never reads the
  // 400 MB layer or the ~560k properties addresses.
  let parcels = opts.parcelIndex;
  let addresses = opts.addressIndex ?? null;
  // Statement size limit, read once from the target server (packet.ts).
  let budget: number | null = null;

  const results: RenthubBatchResult[] = [];
  for (const b of batches) {
    if (opts.shouldStop?.()) break;
    const file = path.basename(b.file);
    if (loaded.get(b.batch) === b.bytes) {
      results.push({ batch: b.batch, file, status: "skipped", rows: 0 });
      continue;
    }
    const start = performance.now();
    const rows = await readBatch(b);
    parcels ??= await ParcelIndex.fromGeojson(parcelsPath);
    if (!addresses && geoOpts.addressRadiusM > 0) {
      addresses = await AddressIndex.fromDb(query);
      log.info({ entries: addresses.size }, "properties addresses loaded");
    }
    const geo = geocodeRows(rows, parcels, addresses, geoOpts);
    if (opts.dryRun) {
      results.push({
        batch: b.batch,
        file,
        status: "parsed",
        rows: rows.length,
        geocode: geo,
      });
      log.info({ batch: b.batch, rows: rows.length, ...geo }, "parsed");
      continue;
    }
    let affectedRows = 0;
    budget ??= rowBudget(await maxAllowedPacket(query));
    for (const chunk of chunkRows(rows, budget))
      affectedRows += await upsertChunk(query, chunk);
    await recordLoad(query, b, rows.length, geo, parcelsPath);
    const ms = Math.round(performance.now() - start);
    results.push({
      batch: b.batch,
      file,
      status: "loaded",
      rows: rows.length,
      geocode: geo,
      affectedRows,
      ms,
    });
    log.info(
      { batch: b.batch, rows: rows.length, ...geo, affectedRows, ms },
      "loaded",
    );
  }

  const total = (s: RenthubBatchResult["status"]) =>
    results.filter((r) => r.status === s);

  // Any batch written → the Summary / Exploration counts are stale: rebuild.
  const freq =
    total("loaded").length > 0
      ? await refreshFreqTables(
          query,
          opts.tx ??
            ((fn) =>
              (opts.local ? localTransaction : transaction)((q) =>
                fn(q as Db),
              )),
          [{ table: "renthub_listings", dateColumns: RENTHUB_DATE_COLUMNS }],
        )
      : null;

  const geocodeTotals = emptyCounts();
  for (const r of results)
    for (const k of Object.keys(geocodeTotals) as (keyof GeocodeCounts)[])
      geocodeTotals[k] += r.geocode?.[k] ?? 0;
  return {
    target: opts.dryRun ? "none (dry run)" : opts.local ? "local" : "remote",
    root,
    batchesOnDisk: batches.length,
    loaded: total("loaded").length,
    parsed: total("parsed").length,
    skipped: total("skipped").length,
    parcelLayer: parcels ? parcelsPath : null,
    ...geoOpts,
    rows: results.reduce((n, r) => n + r.rows, 0),
    geocode: geocodeTotals,
    freq,
    batches: results,
  };
}
