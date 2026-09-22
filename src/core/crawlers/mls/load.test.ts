import { describe, expect, test } from "bun:test";

import { MLS_COLUMN_NAMES, MLS_COLUMNS, type MlsColumnName } from "./columns";
import {
  buildHistoryInsert,
  buildInsert,
  buildSelectExisting,
  buildTouchSeen,
  buildUpdate,
  chunk,
  columnValues,
  decideAction,
  diffListing,
  keepListPriceOnSale,
  MlsLoadError,
  normalizeValue,
  preserveListTracked,
  rowToExisting,
  serializeExtra,
  TOUCH_CHUNK_SIZE,
  truncatedColumns,
  type ExistingListing,
  type LoadMeta,
} from "./load";
import type { ColumnValue, NormalizedListing } from "./types";

const meta: LoadMeta = {
  site: "hicentral",
  priority: 10,
  sourceUrl: "https://example.test/listing/000000001",
  htmlPath: "/nas/mls/hicentral/000000001.html",
};

function listing(over: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    mlsBoard: "HBR",
    mlsNumber: "000000001",
    status: "active",
    statusRaw: "Active",
    fields: {
      list_price: 1_250_000,
      tenure: "FS",
      address: "123 Test St",
      island: "Oahu",
      tmk: "1-3-5-059-010-0000",
      list_date: "2026-09-01",
      bedrooms: 3,
      year_built: 1947,
      view: "Ocean, Mountain",
      pool: null,
    },
    extra: { "Some Key": "Some value" },
    ...over,
  };
}

/** The ExistingListing a just-loaded `l` would read back as. */
function existingFrom(
  l: NormalizedListing,
  sourcePriority = 10,
): ExistingListing {
  const values = columnValues(l);
  const fields = {} as Record<MlsColumnName, ColumnValue>;
  MLS_COLUMNS.forEach((s, i) => {
    fields[s.column] = values[i];
  });
  return {
    id: 1,
    sourcePriority,
    status: l.status,
    statusRaw: l.statusRaw,
    extra: serializeExtra(l.extra),
    fields,
  };
}

const placeholders = (sql: string) => (sql.match(/\?/g) ?? []).length;

/** Every bare word in a statement that is not SQL syntax must be backticked. */
function unquotedIdentifiers(sql: string): string[] {
  const stripped = sql.replace(/`[^`]+`/g, "").replace(/'[^']*'/g, "");
  const keywords = new Set([
    "INSERT",
    "INTO",
    "VALUES",
    "NOW",
    "UPDATE",
    "SET",
    "WHERE",
    "AND",
    "SELECT",
    "FROM",
    "LIMIT",
    "AS",
    "DATE_FORMAT",
    "IN",
    "NOT",
  ]);
  return (stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter(
    (w) => !keywords.has(w),
  );
}

describe("buildInsert", () => {
  const { sql, params } = buildInsert(listing(), meta);

  test("placeholder count equals param count", () => {
    expect(placeholders(sql)).toBe(params.length);
    // board, number, 5 leading, all data columns, extra, html_path
    expect(params.length).toBe(2 + 5 + MLS_COLUMN_NAMES.length + 2);
  });

  test("column list has every MLS column exactly once, in order, all backticked", () => {
    const cols = sql
      .slice(sql.indexOf("(") + 1, sql.indexOf(") VALUES"))
      .split(", ");
    for (const c of cols) expect(c).toMatch(/^`[a-z0-9_]+`$/);
    const names = cols.map((c) => c.slice(1, -1));
    expect(new Set(names).size).toBe(names.length);
    const start = names.indexOf(MLS_COLUMN_NAMES[0]);
    expect(names.slice(start, start + MLS_COLUMN_NAMES.length)).toEqual(
      MLS_COLUMN_NAMES,
    );
    expect(sql).toContain("`view`");
    expect(sql).toContain("`security`");
    expect(sql).toContain("`pool`");
    expect(unquotedIdentifiers(sql)).toEqual([]);
  });

  test("all four DATETIMEs are NOW(), never params", () => {
    expect((sql.match(/NOW\(\)/g) ?? []).length).toBe(4);
    for (const c of [
      "first_seen_at",
      "last_seen_at",
      "fetched_at",
      "parsed_at",
    ]) {
      expect(sql).toContain(`\`${c}\``);
    }
    expect(params.some((p) => (p as unknown) instanceof Date)).toBe(false);
  });

  test("params line up with their columns; absent fields are NULL", () => {
    const cols = sql
      .slice(sql.indexOf("(") + 1, sql.indexOf(") VALUES"))
      .split(", ")
      .map((c) => c.slice(1, -1));
    const at = (c: string) => params[cols.indexOf(c)];
    expect(at("mls_board")).toBe("HBR");
    expect(at("mls_number")).toBe("000000001");
    expect(at("source_site")).toBe("hicentral");
    expect(at("source_priority")).toBe(10);
    expect(at("status")).toBe("active");
    expect(at("status_raw")).toBe("Active");
    expect(at("list_price")).toBe(1_250_000);
    expect(at("view")).toBe("Ocean, Mountain");
    expect(at("list_date")).toBe("2026-09-01");
    expect(at("html_path")).toBe(meta.htmlPath);
    expect(at("extra")).toBe('{"Some Key":"Some value"}');
    // absent / explicit null
    expect(at("sold_price")).toBeNull();
    expect(at("remarks")).toBeNull();
    expect(at("pool")).toBeNull();
    const given = new Set(Object.keys(listing().fields));
    for (const c of MLS_COLUMN_NAMES)
      if (!given.has(c)) expect(at(c)).toBeNull();
  });

  test("empty extra is NULL", () => {
    const s = buildInsert(listing({ extra: {} }), meta);
    const cols = s.sql
      .slice(s.sql.indexOf("(") + 1, s.sql.indexOf(") VALUES"))
      .split(", ");
    expect(s.params[cols.indexOf("`extra`")]).toBeNull();
  });
});

describe("buildUpdate", () => {
  const { sql, params } = buildUpdate(listing(), meta);

  test("placeholder count equals param count", () => {
    expect(placeholders(sql)).toBe(params.length);
    expect(params.length).toBe(5 + MLS_COLUMN_NAMES.length + 2 + 3);
  });

  test("never touches first_seen_at, id or the key; bumps the other three timestamps", () => {
    const setClause = sql.slice(
      sql.indexOf(" SET ") + 5,
      sql.indexOf(" WHERE "),
    );
    expect(setClause).not.toContain("first_seen_at");
    expect(setClause).not.toContain("`id`");
    expect(setClause).not.toContain("`mls_board`");
    expect(setClause).not.toContain("`mls_number`");
    for (const c of ["last_seen_at", "fetched_at", "parsed_at"]) {
      expect(setClause).toContain(`\`${c}\` = NOW()`);
    }
    for (const c of MLS_COLUMN_NAMES)
      expect(setClause).toContain(`\`${c}\` = ?`);
    for (const c of [
      "source_site",
      "source_priority",
      "source_url",
      "status",
      "status_raw",
      "extra",
      "html_path",
    ]) {
      expect(setClause).toContain(`\`${c}\` = ?`);
    }
    expect(unquotedIdentifiers(sql)).toEqual([]);
  });

  test("WHERE is keyed on (board, number) and guarded by priority", () => {
    expect(sql).toMatch(
      /WHERE `mls_board` = \? AND `mls_number` = \? AND `source_priority` <= \?$/,
    );
    expect(params.slice(-3)).toEqual(["HBR", "000000001", 10]);
  });

  test("reparse stamps parsed_at only", () => {
    const r = buildUpdate(listing(), meta, { reparse: true });
    const setClause = r.sql.slice(
      r.sql.indexOf(" SET ") + 5,
      r.sql.indexOf(" WHERE "),
    );
    expect(setClause).toContain("`parsed_at` = NOW()");
    expect(setClause).not.toContain("last_seen_at");
    expect(setClause).not.toContain("fetched_at");
    expect(setClause).not.toContain("first_seen_at");
    expect(placeholders(r.sql)).toBe(r.params.length);
  });

  test("a field absent from this fetch is written as NULL", () => {
    const assigns = sql
      .slice(sql.indexOf(" SET ") + 5, sql.indexOf(" WHERE "))
      .split(", ");
    const idx = assigns.indexOf("`view` = ?");
    const withView = buildUpdate(listing(), meta).params[idx];
    const l = listing();
    delete l.fields.view;
    expect(withView).toBe("Ocean, Mountain");
    expect(buildUpdate(l, meta).params[idx]).toBeNull();
  });
});

describe("other builders", () => {
  test("buildSelectExisting: backticked, dates via DATE_FORMAT", () => {
    const { sql, params } = buildSelectExisting("HBR", "000000001");
    expect(placeholders(sql)).toBe(params.length);
    expect(sql).toContain(
      "DATE_FORMAT(`list_date`, '%Y-%m-%d') AS `list_date`",
    );
    expect(sql).toContain(
      "DATE_FORMAT(`date_sold`, '%Y-%m-%d') AS `date_sold`",
    );
    for (const c of MLS_COLUMN_NAMES) expect(sql).toContain(`\`${c}\``);
    expect(unquotedIdentifiers(sql)).toEqual([]);
  });

  test("buildHistoryInsert", () => {
    const { sql, params } = buildHistoryInsert({
      board: "HBR",
      mlsNumber: "000000001",
      status: "sold",
      listPrice: 100,
      soldPrice: null,
      site: "hicentral",
      changeType: "status",
    });
    expect(placeholders(sql)).toBe(params.length);
    expect(sql).toContain("`observed_at`");
    expect(sql).toContain("NOW()");
    expect(params).toEqual([
      "HBR",
      "000000001",
      "sold",
      100,
      null,
      "hicentral",
      "status",
    ]);
    expect(unquotedIdentifiers(sql)).toEqual([]);
  });

  test("buildTouchSeen + chunk keep IN lists at <= 500", () => {
    const numbers = Array.from({ length: 1201 }, (_, i) => String(i));
    const parts = chunk(numbers, TOUCH_CHUNK_SIZE);
    expect(parts.map((p) => p.length)).toEqual([500, 500, 201]);
    for (const p of parts) {
      const s = buildTouchSeen("HBR", p);
      expect(placeholders(s.sql)).toBe(s.params.length);
      expect(s.params.length).toBe(p.length + 1);
      expect(s.sql).toContain("`last_seen_at` = NOW()");
      expect(unquotedIdentifiers(s.sql)).toEqual([]);
    }
    expect(() => buildTouchSeen("HBR", [])).toThrow(MlsLoadError);
    expect(() => buildTouchSeen("HBR", numbers)).toThrow(MlsLoadError);
  });
});

describe("value normalization", () => {
  const spec = (c: MlsColumnName) => MLS_COLUMNS.find((s) => s.column === c)!;

  test("BIGINT / INT strings from the driver compare equal to numbers", () => {
    expect(normalizeValue(spec("list_price"), "1250000")).toBe(1_250_000);
    expect(normalizeValue(spec("bedrooms"), 3)).toBe(3);
    expect(normalizeValue(spec("bedrooms"), "")).toBeNull();
    expect(normalizeValue(spec("bedrooms"), Number.NaN)).toBeNull();
  });

  test("dates", () => {
    expect(normalizeValue(spec("list_date"), "2026-09-01")).toBe("2026-09-01");
    expect(
      normalizeValue(spec("list_date"), new Date("2026-09-01T00:00:00Z")),
    ).toBe("2026-09-01");
  });

  test("over-long VARCHAR values are truncated and reported", () => {
    const l = listing({ fields: { tenure: "FSX", remarks: "x".repeat(5000) } });
    expect(truncatedColumns(l)).toEqual(["tenure"]);
    expect(normalizeValue(spec("tenure"), "FSX")).toBe("FS");
    expect(
      (normalizeValue(spec("remarks"), "x".repeat(5000)) as string).length,
    ).toBe(5000);
  });

  test("a field key that is not a column throws instead of being dropped", () => {
    const l = listing();
    (l.fields as Record<string, ColumnValue>).not_a_column = "x";
    expect(() => columnValues(l)).toThrow(MlsLoadError);
    expect(() => buildInsert(l, meta)).toThrow(/not_a_column/);
  });

  test("serializeExtra is key-order independent; empty → null", () => {
    expect(serializeExtra({ b: "2", a: "1" })).toBe(
      serializeExtra({ a: "1", b: "2" }),
    );
    expect(serializeExtra({})).toBeNull();
  });

  test("rowToExisting round-trips a DB-shaped row", () => {
    const e = rowToExisting({
      id: 7,
      source_priority: 10,
      status: "active",
      status_raw: null,
      extra: null,
      list_price: "1250000",
      bedrooms: 3,
      list_date: "2026-09-01",
      view: "Ocean",
    });
    expect(e.id).toBe(7);
    expect(e.fields.list_price).toBe(1_250_000);
    expect(e.fields.list_date).toBe("2026-09-01");
    expect(e.fields.sold_price).toBeNull();
    expect(Object.keys(e.fields).sort()).toEqual([...MLS_COLUMN_NAMES].sort());
  });
});

describe("decideAction (priority)", () => {
  test("no row → insert", () =>
    expect(decideAction(null, meta)).toBe("insert"));
  test("existing higher priority → skip", () =>
    expect(decideAction({ sourcePriority: 20 }, meta)).toBe(
      "skip_lower_priority",
    ));
  test("equal priority → update", () =>
    expect(decideAction({ sourcePriority: 10 }, meta)).toBe("update"));
  test("existing lower priority → update", () =>
    expect(decideAction({ sourcePriority: 0 }, meta)).toBe("update"));
});

describe("diffListing", () => {
  test("identical reload → no changes, no history", () => {
    const l = listing();
    expect(diffListing(existingFrom(l), l)).toEqual({
      changedColumns: [],
      changeType: null,
    });
  });

  test("driver-shaped values (string BIGINT, reordered extra) are not changes", () => {
    const l = listing({ extra: { b: "2", a: "1" } });
    const e = existingFrom(l);
    (e.fields as Record<string, unknown>).list_price = "1250000";
    e.extra = '{"b":"2","a":"1"}';
    expect(diffListing(e, l).changedColumns).toEqual([]);
  });

  test("extra handed back by the driver as a parsed object is not a change", () => {
    const l = listing({ extra: { b: "2", a: "1" } });
    const e = rowToExisting({
      id: 1,
      source_priority: 10,
      status: "active",
      status_raw: "Active",
      extra: { b: "2", a: "1" },
      ...Object.fromEntries(
        MLS_COLUMNS.map((s, i) => [s.column, columnValues(l)[i]]),
      ),
    });
    expect(e.extra).toBe('{"b":"2","a":"1"}');
    expect(diffListing(e, l).changedColumns).toEqual([]);
  });

  test("list price change → price", () => {
    const e = existingFrom(listing());
    const next = listing();
    next.fields.list_price = 1_199_000;
    expect(diffListing(e, next)).toEqual({
      changedColumns: ["list_price"],
      changeType: "price",
    });
  });

  test("sold price appearing alone → price", () => {
    const e = existingFrom(listing());
    const next = listing();
    next.fields.sold_price = 1_200_000;
    expect(diffListing(e, next).changeType).toBe("price");
  });

  test("status change → status", () => {
    const e = existingFrom(listing());
    const d = diffListing(
      e,
      listing({ status: "pending", statusRaw: "Pending" }),
    );
    expect(d.changeType).toBe("status");
    expect(d.changedColumns).toEqual(["status", "status_raw"]);
  });

  test("status and price together → status+price", () => {
    const e = existingFrom(listing());
    const next = listing({ status: "sold", statusRaw: "Sold" });
    next.fields.sold_price = 1_200_000;
    next.fields.date_sold = "2026-09-17";
    expect(diffListing(e, next).changeType).toBe("status+price");
  });

  test("a non-price data change is 'updated' but writes no history", () => {
    const e = existingFrom(listing());
    const next = listing();
    next.fields.remarks = "New remarks";
    expect(diffListing(e, next)).toEqual({
      changedColumns: ["remarks"],
      changeType: null,
    });
  });

  test("a field that disappears from the page is a change (→ NULL)", () => {
    const e = existingFrom(listing());
    const next = listing();
    delete next.fields.view;
    expect(diffListing(e, next).changedColumns).toEqual(["view"]);
  });

  test("extra-only and status_raw-only changes count as updated", () => {
    const e = existingFrom(listing());
    expect(diffListing(e, listing({ extra: {} })).changedColumns).toEqual([
      "extra",
    ]);
    expect(
      diffListing(e, listing({ statusRaw: "ACTIVE" })).changedColumns,
    ).toEqual(["status_raw"]);
  });
});

describe("preserveListTracked (reparse must not undo list-row updates)", () => {
  const existing = {
    id: 1,
    sourcePriority: 100,
    status: "active_under_contract",
    statusRaw: "Active Under Contract",
    extra: null,
    fields: { list_price: 650000 },
  } as unknown as ExistingListing;
  const snapshot = (
    status: NormalizedListing["status"],
  ): NormalizedListing => ({
    mlsBoard: "HBR",
    mlsNumber: "202600001",
    status,
    statusRaw: status,
    fields: { list_price: 699000, bedrooms: 3 },
    extra: {},
  });

  test("an open snapshot keeps the stored status and list price, takes everything else", () => {
    const r = preserveListTracked(snapshot("active"), existing);
    expect(r.status).toBe("active_under_contract");
    expect(r.statusRaw).toBe("Active Under Contract");
    expect(r.fields.list_price).toBe(650000);
    expect(r.fields.bedrooms).toBe(3);
  });

  test("a sold snapshot is final and wins", () => {
    const r = preserveListTracked(snapshot("sold"), existing);
    expect(r.status).toBe("sold");
    expect(r.fields.list_price).toBe(699000);
  });
});

describe("keepListPriceOnSale", () => {
  const held = (listPrice: number | null) =>
    ({
      id: 1,
      sourcePriority: 50,
      status: "active",
      statusRaw: "Active",
      extra: null,
      fields: { list_price: listPrice },
    }) as unknown as ExistingListing;
  const page = (
    status: NormalizedListing["status"],
    fields: NormalizedListing["fields"],
  ): NormalizedListing => ({
    mlsBoard: "HIS",
    mlsNumber: "731101",
    status,
    statusRaw: status,
    fields,
    extra: {},
  });

  test("a sold page with no list price keeps the asking price we already hold", () => {
    const r = keepListPriceOnSale(
      page("sold", { sold_price: 685000 }),
      held(699000),
    );
    expect(r.fields).toEqual({ sold_price: 685000, list_price: 699000 });
  });

  test("a sold page that has its own list price wins (hicentral)", () => {
    const r = keepListPriceOnSale(
      page("sold", { sold_price: 305600, list_price: 300000 }),
      held(310000),
    );
    expect(r.fields.list_price).toBe(300000);
  });

  test("an open page with no price is left alone — absent still means NULL", () => {
    const l = page("active", { bedrooms: 2 });
    expect(keepListPriceOnSale(l, held(500000))).toBe(l);
  });

  test("nothing to keep when we never had a list price", () => {
    const l = page("sold", { sold_price: 160000 });
    expect(keepListPriceOnSale(l, held(null))).toBe(l);
  });
});

describe("buildInsert with observedAt (importing pages saved in the past)", () => {
  const l: NormalizedListing = {
    mlsBoard: "HBR",
    mlsNumber: "202500001",
    status: "active",
    statusRaw: "Active",
    fields: {},
    extra: {},
  };
  const meta = { site: "hres", priority: 50, sourceUrl: "u", htmlPath: null };

  test("backdates the three seen/fetched stamps, parsed_at stays NOW()", () => {
    const stmt = buildInsert(l, { ...meta, observedAt: "2026-02-24 12:39:07" });
    expect(stmt.sql).toMatch(
      /`first_seen_at`, `last_seen_at`, `fetched_at`, `parsed_at`\) VALUES \(.*\?, \?, \?, NOW\(\)\)$/,
    );
    expect(stmt.params.slice(-3)).toEqual([
      "2026-02-24 12:39:07",
      "2026-02-24 12:39:07",
      "2026-02-24 12:39:07",
    ]);
    expect((stmt.sql.match(/\?/g) ?? []).length).toBe(stmt.params.length);
  });

  test("without observedAt everything is NOW() and no extra params", () => {
    const stmt = buildInsert(l, meta);
    expect(stmt.sql).toMatch(/NOW\(\), NOW\(\), NOW\(\), NOW\(\)\)$/);
    expect((stmt.sql.match(/\?/g) ?? []).length).toBe(stmt.params.length);
  });

  test("rejects a Date-ish string that is not HST wall-clock", () => {
    expect(() =>
      buildInsert(l, { ...meta, observedAt: "2026-02-24T12:39:07.000Z" }),
    ).toThrow(/observedAt/);
  });
});
