import { describe, expect, test } from "bun:test";

import { getChangeKind, listChangeKinds } from "./change-kinds";
import { registerChangeKind } from "./change-registry";
import { CHANGE_TYPES } from "./types";

describe("change registry", () => {
  const kinds = listChangeKinds();

  test("the built-in kinds are registered", () => {
    expect(kinds.map((k) => k.kind).sort()).toEqual([
      "loader_create",
      "loader_disable",
      "loader_update",
      "measurement_metadata",
      "reload",
      "series_metadata",
      "unquarantine",
    ]);
  });

  test("every kind maps to a known autonomy setting", () => {
    for (const k of kinds) {
      expect(CHANGE_TYPES as readonly string[]).toContain(k.changeType());
      expect(CHANGE_TYPES as readonly string[]).toContain(
        k.changeType("measurement_series"),
      );
    }
  });

  test("error fixes sort ahead of metadata", () => {
    expect(getChangeKind("loader_update").workClass).toBe("errors");
    expect(getChangeKind("reload").workClass).toBe("errors");
    expect(getChangeKind("series_metadata").workClass).toBe("metadata");
    expect(getChangeKind("measurement_metadata").workClass).toBe("metadata");
  });

  test("direct tool names are unique", () => {
    const names = kinds.flatMap((k) =>
      k.directTool ? [k.directTool.name] : [],
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual([
      "request_reload",
      "update_loader",
      "update_measurement_metadata",
      "update_series_metadata",
    ]);
  });

  test("a kind can't be registered twice, and unknown kinds are named", () => {
    expect(() => registerChangeKind(getChangeKind("reload"))).toThrow("twice");
    expect(() => getChangeKind("nope")).toThrow("Unknown change kind");
  });
});

describe("after schemas", () => {
  const parse = (kind: string, after: unknown) =>
    getChangeKind(kind).afterSchema.safeParse(after);

  test("loader_update takes known fields only, and at least one", () => {
    expect(parse("loader_update", { eval: "x", priority: 90 }).success).toBe(
      true,
    );
    expect(parse("loader_update", {}).success).toBe(false);
    expect(parse("loader_update", { disabled: true }).success).toBe(false);
    expect(parse("loader_update", { priority: "90" }).success).toBe(false);
  });

  test("fixed changes normalize whatever they are given", () => {
    expect(parse("reload", { anything: 1 }).data).toEqual({});
    expect(parse("loader_disable", undefined).data).toEqual({
      disabled: true,
      clearDataPoints: false,
    });
    expect(parse("loader_disable", { clearDataPoints: true }).data).toEqual({
      disabled: true,
      clearDataPoints: true,
    });
    // only a literal true clears
    expect(
      parse("loader_disable", { clearDataPoints: "true" }).data,
    ).toMatchObject({ clearDataPoints: false });
    expect(parse("unquarantine", {}).data).toEqual({ quarantined: false });
  });

  test("loader_create needs an eval", () => {
    expect(parse("loader_create", { priority: 100 }).success).toBe(false);
    expect(parse("loader_create", { eval: "x" }).success).toBe(true);
  });

  test("metadata kinds differ in what they accept", () => {
    expect(parse("measurement_metadata", { source_id: 3 }).success).toBe(true);
    // description and geography live on series only
    expect(parse("measurement_metadata", { description: "x" }).success).toBe(
      false,
    );
    expect(
      parse("series_metadata", { description: "x", geography_id: 2 }).success,
    ).toBe(true);
    expect(parse("series_metadata", { name: "X@HI.M" }).success).toBe(false);
    expect(parse("series_metadata", { unit_id: null }).success).toBe(true);
  });
});
