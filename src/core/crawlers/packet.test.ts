import { describe, expect, test } from "bun:test";

import {
  chunkByBytes,
  MAX_ROWS_PER_STATEMENT,
  maxAllowedPacket,
  rowBudget,
  valueBytes,
} from "./packet";

describe("packet", () => {
  test("reads max_allowed_packet; falls back to 1 MiB", async () => {
    expect(
      await maxAllowedPacket((async () => [
        { max_allowed_packet: "1048576" },
      ]) as never),
    ).toBe(1048576);
    expect(await maxAllowedPacket((async () => []) as never)).toBe(1048576);
    expect(
      await maxAllowedPacket((async () => {
        throw new Error("denied");
      }) as never),
    ).toBe(1048576);
  });

  test("valueBytes counts UTF-8 bytes, not characters", () => {
    expect(valueBytes("ʻ".repeat(10)) - valueBytes("")).toBe(20);
    expect(valueBytes(null)).toBeLessThan(valueBytes(12345));
  });

  test("chunks stay under the budget and the row cap", () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const byCap = chunkByBytes(rows, () => 1, 1e9);
    expect(byCap.map((c) => c.length)).toEqual([
      MAX_ROWS_PER_STATEMENT,
      MAX_ROWS_PER_STATEMENT,
      500,
    ]);
    const byBytes = chunkByBytes(rows, () => 1000, rowBudget(1024 * 1024));
    for (const c of byBytes)
      expect(c.length * 1000).toBeLessThanOrEqual(rowBudget(1024 * 1024));
    expect(byBytes.flat()).toEqual(rows);
  });

  test("a single row bigger than the budget is a clear error", () => {
    expect(() =>
      chunkByBytes([1], () => 2_000_000, rowBudget(1024 * 1024)),
    ).toThrow(/max_allowed_packet too small/);
  });
});
