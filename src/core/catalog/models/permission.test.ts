import { describe, expect, test } from "bun:test";

import Permission from "./permission";

let nextId = 1;
const rule = (resource: string, action: string, allowed: boolean) =>
  new Permission({ id: nextId++, role: "x", resource, action, allowed });

describe("Permission.resolve", () => {
  test("no matching rule denies", () => {
    expect(Permission.resolve([], "series", "read")).toBe(false);
    expect(
      Permission.resolve([rule("hhdb", "read", true)], "series", "read"),
    ).toBe(false);
  });

  test("a sidebar-level rule covers its fine-grained children", () => {
    const rules = [rule("catalog", "update", true)];
    expect(Permission.resolve(rules, "measurement", "update")).toBe(true);
    expect(Permission.resolve(rules, "category", "update")).toBe(true);
    expect(Permission.resolve(rules, "measurement", "delete")).toBe(false);
    // Unrelated resources are not covered.
    expect(Permission.resolve(rules, "series", "update")).toBe(false);
  });

  test("an exact child rule beats the parent, even with a wildcard action", () => {
    const rules = [
      rule("catalog", "update", true),
      rule("measurement", "*", false),
    ];
    expect(Permission.resolve(rules, "measurement", "update")).toBe(false);
    expect(Permission.resolve(rules, "category", "update")).toBe(true);
  });

  test("a parent rule beats wildcards", () => {
    const rules = [
      rule("*", "read", true),
      rule("*", "*", true),
      rule("admin", "read", false),
    ];
    expect(Permission.resolve(rules, "worker", "read")).toBe(false);
    expect(Permission.resolve(rules, "series", "read")).toBe(true);
  });

  test("exact action beats wildcard action at the same resource level", () => {
    const rules = [rule("hhdb", "*", false), rule("hhdb", "read", true)];
    expect(Permission.resolve(rules, "hhdb", "read")).toBe(true);
    expect(Permission.resolve(rules, "hhdb", "update")).toBe(false);
  });

  test("the seeded internal baseline denies sidebar resources despite old wildcards", () => {
    // Pre-existing rows from the first RBAC migration plus the new seed.
    const rules = [
      rule("*", "read", true),
      rule("*", "create", true),
      rule("series", "read", false),
      rule("catalog", "create", false),
    ];
    expect(Permission.resolve(rules, "series", "read")).toBe(false);
    expect(Permission.resolve(rules, "measurement", "create")).toBe(false);
    // Non-CRUD actions still fall through to whatever wildcard exists.
    expect(Permission.resolve(rules, "series", "execute")).toBe(false);
  });
});
