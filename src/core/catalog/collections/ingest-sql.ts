/**
 * Helpers for the data-ingest collections' variable-length IN lists and
 * multi-row INSERTs. Bun SQL keeps every distinct statement text prepared
 * on the server for the life of the connection, so list lengths come from
 * a fixed ladder (≤ 9 distinct statements per query shape) rather than
 * the natural length of each list.
 */

export const LADDER = [256, 128, 64, 32, 16, 8, 4, 2, 1] as const;

/** Split `items` into chunks whose sizes are all ladder rungs. */
export function ladderChunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const left = items.length - i;
    const size = LADDER.find((n) => n <= left)!;
    out.push(items.slice(i, i + size));
    i += size;
  }
  return out;
}

/** "?, ?, ?" for `n` positional parameters. */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}
