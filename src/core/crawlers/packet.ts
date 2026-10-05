import { createLogger } from "@/core/observability/logger";

import type { Db } from "./address";

const log = createLogger("packet");

/**
 * Multi-row INSERTs must fit the server's max_allowed_packet, which is set
 * per server and can be small: the remote hhdb (MariaDB 10.11) allows only
 * 1 MiB (checked 2026-10-05), and a renthub load chunked by a 4 MB guess died
 * with "Got a packet bigger than 'max_allowed_packet' bytes". So the limit is
 * read from the server at the start of each load, and chunks are sized from
 * real UTF-8 byte lengths.
 */

/** Fallback when the variable cannot be read: the smallest common default. */
const FALLBACK_MAX_PACKET = 1024 * 1024;
/** Share of the packet the rows may use; the rest is headroom for the statement. */
const BUDGET_SHARE = 0.75;

/**
 * The only row counts a statement may have. Bun keeps every DISTINCT
 * statement prepared on the server for the life of the connection (verified
 * 2026-10-05: 50 distinct statements → Prepared_stmt_count 50; 50 repeats of
 * one → 1). Chunks of arbitrary size made every INSERT a new prepared
 * statement with tens of thousands of parameters — ~370 of them in one FICOH
 * transaction — and the remote MariaDB was restarted mid-load (out of
 * memory). With this ladder a table needs at most 9 prepared statements, each
 * at most 256 rows.
 */
export const CHUNK_SIZES = [256, 128, 64, 32, 16, 8, 4, 2, 1] as const;

/** The server's max_allowed_packet in bytes. */
export async function maxAllowedPacket(db: Db): Promise<number> {
  try {
    const [row] = await db<{ max_allowed_packet: number | string }>(
      "SELECT @@max_allowed_packet AS max_allowed_packet",
    );
    const n = Number(row?.max_allowed_packet);
    if (Number.isFinite(n) && n > 0) return n;
  } catch (err) {
    log.warn({ err }, "could not read max_allowed_packet; assuming 1 MiB");
  }
  return FALLBACK_MAX_PACKET;
}

/** Bytes the rows of one statement may use, given the server's limit. */
export function rowBudget(maxPacket: number): number {
  return Math.floor(maxPacket * BUDGET_SHARE);
}

/**
 * Upper bound on one value's share of an INSERT: its wire encoding in the
 * execute packet (length prefix + bytes, or a fixed-width number) plus its
 * "?, " placeholder and 2-byte type code. Over-counts on purpose.
 */
export function valueBytes(v: unknown): number {
  const overhead = 3 + 2;
  if (v == null) return overhead + 1;
  if (typeof v === "string") return overhead + 9 + Buffer.byteLength(v, "utf8");
  return overhead + 9;
}

/**
 * Split rows into statements that each fit the byte budget AND have a row
 * count from CHUNK_SIZES: at each point, the largest size whose rows fit.
 * Order is preserved.
 */
export function chunkByBytes<T>(
  rows: readonly T[],
  rowBytes: (row: T) => number,
  budget: number,
): T[][] {
  // prefix[i] = bytes of rows[0..i)
  const prefix = new Float64Array(rows.length + 1);
  rows.forEach((row, i) => {
    const bytes = rowBytes(row);
    if (bytes > budget)
      throw new Error(
        `Row ${i} needs ~${bytes} bytes, more than the ${budget}-byte budget ` +
          `(server max_allowed_packet too small for this data)`,
      );
    prefix[i + 1] = prefix[i] + bytes;
  });
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length;) {
    const size = CHUNK_SIZES.find(
      (n) => i + n <= rows.length && prefix[i + n] - prefix[i] <= budget,
    )!; // 1 always fits: every row was checked above.
    chunks.push(rows.slice(i, i + size));
    i += size;
  }
  return chunks;
}
