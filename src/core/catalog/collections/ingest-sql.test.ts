import { describe, expect, test } from "bun:test";

import { LADDER, ladderChunks, placeholders } from "./ingest-sql";

describe("ladderChunks", () => {
  test("every chunk size is a ladder rung and nothing is lost", () => {
    for (const n of [0, 1, 2, 3, 7, 255, 256, 257, 1000]) {
      const items = Array.from({ length: n }, (_, i) => i);
      const chunks = ladderChunks(items);
      expect(chunks.flat()).toEqual(items);
      for (const c of chunks) {
        expect((LADDER as readonly number[]).includes(c.length)).toBe(true);
      }
    }
  });

  test("uses the largest rung that fits", () => {
    expect(ladderChunks(Array(300).fill(0)).map((c) => c.length)).toEqual([
      256, 32, 8, 4,
    ]);
  });
});

test("placeholders", () => {
  expect(placeholders(3)).toBe("?, ?, ?");
  expect(placeholders(0)).toBe("");
});
