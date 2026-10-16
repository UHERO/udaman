import { describe, expect, test } from "bun:test";

import { assertSourceKey, buildRegistry, getSource, SOURCES } from "./registry";
import type { SourceModule } from "./types";

const parseOnly: SourceModule = {
  key: "parse_only",
  description: "test",
  version: 1,
  dimensions: () => ["series"],
  parse: () => ({ rows: [] }),
};

describe("registry", () => {
  test("keys match their modules", () => {
    for (const [key, m] of Object.entries(SOURCES)) expect(m.key).toBe(key);
  });

  test("a duplicate key is rejected", () => {
    expect(() => buildRegistry([parseOnly, parseOnly])).toThrow(/Duplicate/);
  });

  test("an unknown key names the known ones", () => {
    expect(() => getSource("nope")).toThrow(/No source module "nope"/);
  });

  test("assertSourceKey requires a key", () => {
    expect(() => assertSourceKey(null, "extract")).toThrow(
      /needs a source key/,
    );
    expect(() => assertSourceKey("", "custom-fetch")).toThrow(
      /needs a source key/,
    );
  });
});
