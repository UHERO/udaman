import { describe, expect, test } from "bun:test";

import {
  CHUNK_SIZES,
  chunkByBytes,
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

  test("every chunk fits the budget AND has a ladder size (few distinct prepared statements)", () => {
    // Row sizes that vary a lot, like listing descriptions.
    const rows = Array.from({ length: 5000 }, (_, i) => i);
    const bytes = (i: number) => 200 + ((i * 7919) % 40) * 900;
    const budget = rowBudget(1024 * 1024);
    const chunks = chunkByBytes(rows, bytes, budget);
    expect(chunks.flat()).toEqual(rows);
    const sizes = new Set(chunks.map((c) => c.length));
    for (const n of sizes) expect(CHUNK_SIZES).toContain(n as never);
    expect(sizes.size).toBeLessThanOrEqual(CHUNK_SIZES.length);
    for (const c of chunks)
      expect(c.reduce((n, r) => n + bytes(r), 0)).toBeLessThanOrEqual(budget);
  });

  test("small rows use full 256-row statements, and the remainder decomposes into ladder sizes", () => {
    const chunks = chunkByBytes(
      Array.from({ length: 600 }, (_, i) => i),
      () => 10,
      1e9,
    );
    expect(chunks.map((c) => c.length)).toEqual([256, 256, 64, 16, 8]);
  });

  test("a single row bigger than the budget is a clear error", () => {
    expect(() =>
      chunkByBytes([1], () => 2_000_000, rowBudget(1024 * 1024)),
    ).toThrow(/max_allowed_packet too small/);
  });
});
