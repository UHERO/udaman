import { describe, expect, test } from "bun:test";

import { loadOptsFor } from "./qpub-file-load";

describe("loadOptsFor", () => {
  test("condo stubs insert into properties with IGNORE and no ON DUPLICATE", () => {
    const opts = loadOptsFor("condo_stub_properties");
    expect(opts.actualTable).toBe("properties");
    expect(opts.columns).toEqual(["tmk", "island_code"]);
    expect(opts.insertIgnore).toBe(true);
    // Regression: with both IGNORE and ON DUPLICATE KEY UPDATE present,
    // ON DUPLICATE wins and VALUES(col) of unlisted columns is NULL, so a
    // stub row nulls out the full properties row loaded before it.
    expect(opts.onDuplicate).toBeUndefined();
  });

  test("properties load keeps its ON DUPLICATE clause", () => {
    const opts = loadOptsFor("properties");
    expect(opts.actualTable).toBe("properties");
    expect(opts.insertIgnore).toBe(false);
    expect(opts.onDuplicate).toContain("project_name=VALUES(project_name)");
  });

  test("tables without an ON DUPLICATE entry get plain INSERTs", () => {
    const opts = loadOptsFor("sales");
    expect(opts.actualTable).toBe("sales");
    expect(opts.insertIgnore).toBe(false);
    expect(opts.onDuplicate).toBeUndefined();
  });
});
