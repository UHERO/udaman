/**
 * Back-fill renthub_listings.unit_id / property_id from the vendor's id
 * mapping file:
 *
 *   /Volumes/UHEROroot/datashare/renthub/mut_mapping.csv.gz
 *   id,property id,unit id        (~2.5 GB gzipped, every state)
 *
 * The delivery files only carry `unit id` / `property id` from 2023-07-28 on;
 * the mapping (created Nov 2023) covers listings up to then, so together
 * they give every listing its unit and property. The vendor says that where
 * both exist the values match: a NULL is filled, a differing stored value is
 * left as the delivery file had it and reported as a conflict.
 *
 * The file is streamed through `gzip -dc` and parsed byte by byte; only the
 * ids already in renthub_listings are kept, so memory stays at the size of
 * the table, not the file. The loader's upsert never clears these columns
 * (load.ts), so a reload keeps them; after loading pre-2023-07-28 deliveries
 * into an empty table, rerun this.
 */

import { existsSync } from "fs";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";
import { localRawQuery } from "@/lib/mysql/hhdb-local";

import type { Db } from "../address";
import type { Tx } from "../freq-refresh";
import { resilient } from "../mls/db-retry";
import { CHUNK_SIZES } from "../packet";
import { refreshFreq } from "./load";

const log = createLogger("renthub-map");

export const DEFAULT_MAPPING_PATH =
  "/Volumes/UHEROroot/datashare/renthub/mut_mapping.csv.gz";

const EXPECTED_HEADER = "id,property id,unit id";

export interface MapIdsOptions {
  /** Mapping file; default $RENTHUB_MAPPING_PATH or the NAS path. */
  mapping?: string;
  /** Read and match everything, write nothing. */
  dryRun?: boolean;
  /** Write to the local rebuild DB instead of the remote housing DB. */
  local?: boolean;
  shouldStop?: () => boolean;
  db?: Db;
  tx?: Tx;
  /** Mapping lines, for tests; otherwise streamed from `mapping`. */
  source?: AsyncIterable<Uint8Array>;
}

export function resolveMappingPath(mapping?: string): string {
  return (
    mapping?.trim() ||
    process.env.RENTHUB_MAPPING_PATH?.trim() ||
    DEFAULT_MAPPING_PATH
  );
}

/** What renthub_listings holds for one id: [unit_id, property_id]. */
type Stored = [number | null, number | null];

/** One change to write: id, and the values to set (null = leave as is). */
export interface IdUpdate {
  id: number;
  unitId: number | null;
  propertyId: number | null;
}

export interface MappingScan {
  /** Data lines in the file. */
  lines: number;
  /** Listings found in the file. */
  matched: number;
  updates: IdUpdate[];
  /** Listings whose stored value differs from the mapping, per column. */
  conflicts: { unit_id: number; property_id: number };
  /** A few conflicting ids, for spot checks. */
  conflictSamples: {
    id: number;
    column: string;
    stored: number;
    mapping: number;
  }[];
}

const NL = 10;
const COMMA = 44;
const CR = 13;

/**
 * Parse `id,property id,unit id` lines from byte chunks and compare each id
 * the table holds with its stored values. Byte-level on purpose: the file is
 * ~350M lines, and decoding + splitting strings would dominate the run.
 * A field that is not a plain integer (blank or otherwise) is treated as
 * unknown for that line.
 */
export async function scanMapping(
  chunks: AsyncIterable<Uint8Array>,
  stored: Map<number, Stored>,
  shouldStop?: () => boolean,
): Promise<MappingScan> {
  const scan: MappingScan = {
    lines: 0,
    matched: 0,
    updates: [],
    conflicts: { unit_id: 0, property_id: 0 },
    conflictSamples: [],
  };
  let header = true;
  let headerBytes: number[] = [];
  // Current line: fields as numbers, -1 = blank / not an integer.
  const field = [0, 0, 0];
  let fieldNo = 0;
  let digits = 0;
  let bad = false;

  const endField = () => {
    if (fieldNo < 3) field[fieldNo] = bad || digits === 0 ? -1 : field[fieldNo];
    fieldNo++;
    digits = 0;
    bad = false;
  };
  const endLine = () => {
    endField();
    const [id, propertyId, unitId] = field;
    field[0] = field[1] = field[2] = 0;
    const n = fieldNo;
    fieldNo = 0;
    if (n === 1 && id === -1) return; // blank line
    scan.lines++;
    if (n !== 3)
      throw new Error(
        `mapping line ${scan.lines}: expected 3 fields, got ${n}`,
      );
    if (id < 0) return;
    const have = stored.get(id);
    if (!have) return;
    scan.matched++;
    const [unit, property] = have;
    const want: [string, number, number | null][] = [
      ["unit_id", unitId, unit],
      ["property_id", propertyId, property],
    ];
    const set: (number | null)[] = [null, null];
    want.forEach(([column, mapped, current], i) => {
      if (mapped < 0) return;
      if (current === null) set[i] = mapped;
      else if (current !== mapped) {
        scan.conflicts[column as "unit_id" | "property_id"]++;
        if (scan.conflictSamples.length < 20)
          scan.conflictSamples.push({
            id,
            column,
            stored: current,
            mapping: mapped,
          });
      }
    });
    if (set[0] !== null || set[1] !== null)
      scan.updates.push({ id, unitId: set[0], propertyId: set[1] });
    // An id listed twice in the file is matched once.
    stored.delete(id);
  };

  for await (const chunk of chunks) {
    if (shouldStop?.()) throw new Error("stopped");
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];
      if (header) {
        if (b === NL) {
          const h = new TextDecoder()
            .decode(new Uint8Array(headerBytes))
            .replace(/^﻿/, "")
            .trim();
          if (h !== EXPECTED_HEADER)
            throw new Error(
              `mapping header is ${JSON.stringify(h)}, expected ${JSON.stringify(EXPECTED_HEADER)}`,
            );
          header = false;
          headerBytes = [];
        } else headerBytes.push(b);
        continue;
      }
      if (b === NL) endLine();
      else if (b === COMMA) endField();
      else if (b === CR) continue;
      else if (fieldNo < 3) {
        const d = b - 48;
        if (d < 0 || d > 9) bad = true;
        else {
          field[fieldNo] = field[fieldNo] * 10 + d;
          digits++;
        }
      }
    }
  }
  if (fieldNo > 0 || digits > 0) endLine();
  return scan;
}

/** `gzip -dc <file>` stdout, or the raw file when it is not gzipped. */
async function* fileChunks(file: string): AsyncIterable<Uint8Array> {
  if (!file.endsWith(".gz")) {
    yield* Bun.file(file).stream();
    return;
  }
  const proc = Bun.spawn(["gzip", "-dc", file], {
    stdout: "pipe",
    stderr: "pipe",
  });
  yield* proc.stdout;
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(
      `gzip -dc ${file} exited ${code}: ${await new Response(proc.stderr).text()}`,
    );
}

/**
 * Fill both columns for one fixed-size chunk. The row count comes from
 * CHUNK_SIZES so only a handful of distinct statements are ever prepared
 * (packet.ts); each row is 3 ints, far under any packet limit.
 */
function updateSql(rows: number): string {
  const values = Array(rows)
    .fill("SELECT ? AS id, ? AS u, ? AS p")
    .join(" UNION ALL ");
  return (
    `UPDATE renthub_listings r JOIN (${values}) m ON r.id = m.id ` +
    "SET r.unit_id = COALESCE(r.unit_id, m.u), r.property_id = COALESCE(r.property_id, m.p)"
  );
}

export async function mapIds(opts: MapIdsOptions = {}) {
  const db = opts.db ?? (opts.local ? (localRawQuery as Db) : (rawQuery as Db));
  const query = resilient("renthub-map", db) as Db;
  const file = resolveMappingPath(opts.mapping);
  if (!opts.source && !existsSync(file))
    throw new Error(`mapping file not found: ${file} (is the NAS mounted?)`);

  const start = performance.now();
  const rows = await query<{
    id: number;
    unit_id: number | null;
    property_id: number | null;
  }>("SELECT id, unit_id, property_id FROM renthub_listings");
  const stored = new Map<number, Stored>();
  const before = { unit_id: 0, property_id: 0 };
  for (const r of rows) {
    const unit = r.unit_id === null ? null : Number(r.unit_id);
    const property = r.property_id === null ? null : Number(r.property_id);
    if (unit !== null) before.unit_id++;
    if (property !== null) before.property_id++;
    stored.set(Number(r.id), [unit, property]);
  }
  log.info(
    { listings: stored.size, ...before },
    "listings read; scanning mapping",
  );

  const scan = await scanMapping(
    opts.source ?? fileChunks(file),
    stored,
    opts.shouldStop,
  );
  const filled = {
    unit_id: scan.updates.filter((u) => u.unitId !== null).length,
    property_id: scan.updates.filter((u) => u.propertyId !== null).length,
  };
  log.info(
    {
      lines: scan.lines,
      matched: scan.matched,
      updates: scan.updates.length,
      ...scan.conflicts,
    },
    "mapping scanned",
  );

  let affectedRows = 0;
  let freq = null;
  if (!opts.dryRun && scan.updates.length) {
    for (let i = 0; i < scan.updates.length;) {
      if (opts.shouldStop?.()) break;
      const size = CHUNK_SIZES.find((n) => i + n <= scan.updates.length)!;
      const chunk = scan.updates.slice(i, i + size);
      const result = (await query(
        updateSql(size),
        chunk.flatMap((u) => [u.id, u.unitId, u.propertyId]),
      )) as unknown as { affectedRows?: number };
      affectedRows += result.affectedRows ?? 0;
      i += size;
    }
    // unit_id / property_id are Summary fields: their counts just changed.
    freq = await refreshFreq({ local: opts.local, db: opts.db, tx: opts.tx });
  }

  const listings = rows.length;
  const after = {
    unit_id: before.unit_id + filled.unit_id,
    property_id: before.property_id + filled.property_id,
  };
  return {
    target: opts.dryRun ? "none (dry run)" : opts.local ? "local" : "remote",
    mapping: opts.source ? "(test source)" : file,
    mappingLines: scan.lines,
    listings,
    listingsInMapping: scan.matched,
    filled,
    affectedRows,
    conflicts: scan.conflicts,
    conflictSamples: scan.conflictSamples,
    coverage: {
      unit_id: { before: before.unit_id, after: after.unit_id, of: listings },
      property_id: {
        before: before.property_id,
        after: after.property_id,
        of: listings,
      },
    },
    freq,
    ms: Math.round(performance.now() - start),
  };
}
