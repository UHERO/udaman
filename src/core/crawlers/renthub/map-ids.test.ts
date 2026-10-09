import { describe, expect, test } from "bun:test";

import { mapIds, scanMapping } from "./map-ids";

const enc = new TextEncoder();

/** The text as byte chunks split every `size` bytes, to cross line and field boundaries. */
async function* chunked(text: string, size = 7): AsyncIterable<Uint8Array> {
  const bytes = enc.encode(text);
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size);
}

const FILE = [
  "id,property id,unit id",
  "100,11055,43471", // stored has neither → both filled
  "200,538437,1008204", // stored matches → nothing
  "300,9,99", // stored unit differs → conflict, property filled
  "400,1,2", // not in the table → ignored
  "500,,77", // blank property → unit only
  "100,1,1", // repeated id → matched once
  "",
].join("\r\n");

const stored = () =>
  new Map<number, [number | null, number | null]>([
    [100, [null, null]],
    [200, [1008204, 538437]],
    [300, [55, null]],
    [500, [null, null]],
    [600, [null, null]],
  ]);

describe("renthub mapping scan", () => {
  test("fills NULLs, reports conflicts, ignores ids not in the table", async () => {
    const scan = await scanMapping(chunked(FILE), stored());
    expect(scan.lines).toBe(6);
    expect(scan.matched).toBe(4);
    expect(scan.updates).toEqual([
      { id: 100, unitId: 43471, propertyId: 11055 },
      { id: 300, unitId: null, propertyId: 9 },
      { id: 500, unitId: 77, propertyId: null },
    ]);
    expect(scan.conflicts).toEqual({ unit_id: 1, property_id: 0 });
    expect(scan.conflictSamples).toEqual([
      { id: 300, column: "unit_id", stored: 55, mapping: 99 },
    ]);
  });

  test("a file without a trailing newline still counts its last line", async () => {
    const scan = await scanMapping(
      chunked("id,property id,unit id\n100,5,6"),
      stored(),
    );
    expect(scan.updates).toEqual([{ id: 100, unitId: 6, propertyId: 5 }]);
  });

  test("an unexpected header or field count stops the run", async () => {
    await expect(
      scanMapping(chunked("id,unit id,property id\n1,2,3\n"), stored()),
    ).rejects.toThrow(/header/);
    await expect(
      scanMapping(chunked("id,property id,unit id\n1,2\n"), stored()),
    ).rejects.toThrow(/expected 3 fields/);
  });

  test("writes only the changed rows, in ladder-sized UPDATEs", async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const db = (async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id, unit_id"))
        return [...stored()].map(([id, [unit_id, property_id]]) => ({
          id,
          unit_id,
          property_id,
        }));
      if (sql.startsWith("UPDATE")) return { affectedRows: params!.length / 3 };
      return [];
    }) as never;
    const result = await mapIds({
      db,
      tx: async (fn) => fn(db),
      source: chunked(FILE),
    });
    const updates = calls.filter((c) => c.sql.startsWith("UPDATE"));
    // 3 rows → one 2-row and one 1-row statement.
    expect(updates.map((u) => u.params!.length / 3)).toEqual([2, 1]);
    expect(updates[0].sql).toContain("COALESCE(r.unit_id, m.u)");
    expect(updates[0].params).toEqual([100, 43471, 11055, 300, null, 9]);
    expect(result.filled).toEqual({ unit_id: 2, property_id: 2 });
    expect(result.coverage.unit_id).toEqual({ before: 2, after: 4, of: 5 });
  });
});
