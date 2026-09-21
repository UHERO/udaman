import { describe, expect, test } from "bun:test";

import { shouldRefetch } from "./pipeline";
import type { SiteAdapter } from "./types";

const hres = { site: "hres", priority: 50 } as SiteAdapter;
const owner = (site: string, priority: number, status: string) =>
  ({ site, priority, status }) as Parameters<typeof shouldRefetch>[0];

describe("backfill: shouldRefetch a listing already in the table", () => {
  test("normally not — that is what makes a rerun cheap", () => {
    expect(shouldRefetch(owner("hres", 50, "active"), hres, "any")).toBe(false);
    expect(shouldRefetch(owner("hres", 50, "sold"), hres, "any")).toBe(false);
  });

  test("never a listing a higher-priority site maintains, even from a sold list", () => {
    expect(shouldRefetch(owner("hicentral", 100, "active"), hres, "any")).toBe(
      false,
    );
    expect(shouldRefetch(owner("hicentral", 100, "active"), hres, "sold")).toBe(
      false,
    );
  });

  test("a lower-priority site's row is taken over", () => {
    expect(shouldRefetch(owner("other", 10, "active"), hres, "any")).toBe(true);
  });

  test("found in a sold list while our row says open or off_market → one fetch records the sale", () => {
    for (const status of [
      "active",
      "active_under_contract",
      "pending",
      "off_market",
    ]) {
      expect(shouldRefetch(owner("hres", 50, status), hres, "sold")).toBe(true);
    }
    // …and only once: after it is recorded as sold a rerun skips it.
    expect(shouldRefetch(owner("hres", 50, "sold"), hres, "sold")).toBe(false);
  });
});
