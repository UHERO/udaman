import { describe, expect, test } from "bun:test";

import type { Fetcher, FetchResult } from "./fetcher";
import type { ListPageResult, SiteAdapter } from "./types";
import { ANOMALY_RETRY_WAITS_MS, walkList } from "./walk";

const PAGE_SIZE = 20;

/** A site with `total` listings, 20 per page; `glitch(page, attempt)` overrides a response. */
function site(
  total: number,
  glitch: (
    page: number,
    attempt: number,
  ) => FetchResult | "empty" | null = () => null,
  maxPage = 499,
) {
  const attempts = new Map<number, number>();
  const calls: { page: number; refetch: boolean }[] = [];
  const sleeps: number[] = [];

  const pageHtml = (page: number, rows: number) =>
    JSON.stringify({ page, rows, total });

  const fetcher: Fetcher = {
    fetchList: async (_url, q, _runDate, opts) => {
      const attempt = (attempts.get(q.page) ?? 0) + 1;
      attempts.set(q.page, attempt);
      calls.push({ page: q.page, refetch: !!opts?.refetch });
      const g = glitch(q.page, attempt);
      if (g === "empty") {
        return {
          kind: "ok",
          html: pageHtml(q.page, 0),
          path: "",
          fromCache: false,
        };
      }
      if (g) return g;
      const start = (q.page - 1) * PAGE_SIZE;
      const rows = Math.max(0, Math.min(PAGE_SIZE, total - start));
      return {
        kind: "ok",
        html: pageHtml(q.page, rows),
        path: "",
        fromCache: false,
      };
    },
    fetchDetail: async () => {
      throw new Error("not used");
    },
    stats: () => ({ requests: 0, cacheHits: 0, retries: 0 }),
    persistent: false,
  };

  const adapter = {
    site: "fake",
    maxPage,
    listUrl: (q: { page: number }) => `https://example.test/list?p=${q.page}`,
    parseList: (html: string): ListPageResult => {
      const { page, rows, total: t } = JSON.parse(html);
      return {
        totalCount: t,
        rows: Array.from({ length: rows }, (_, i) => ({
          mlsNumber: String(202600000 + (page - 1) * PAGE_SIZE + i),
          mlsBoard: "HBR" as const,
          status: "active" as const,
          listPrice: 1,
        })),
      };
    },
  } as unknown as SiteAdapter;

  const counters = { listPages: 0, parseFailures: 0 };
  const run = (maxPages?: number) =>
    walkList(adapter, fetcher, "oahu", "any", "2026-09-20", counters, {
      maxPages,
      sleepImpl: async (ms) => void sleeps.push(ms),
    });
  return { run, calls, sleeps, counters };
}

const REDIRECT: FetchResult = {
  kind: "redirect",
  location: "/PropertySearch/Error.aspx",
};

describe("walkList", () => {
  test("reads every page the result count implies, then stops without an extra request", async () => {
    const s = site(95);
    const w = await s.run();
    expect(w.rows.size).toBe(95);
    expect(s.calls.map((c) => c.page)).toEqual([1, 2, 3, 4, 5]);
    expect(w).toMatchObject({
      complete: true,
      capped: false,
      skippedPages: [],
    });
  });

  test("REGRESSION 2026-09-20: a transient redirect at page 28 of 500 does not end the walk", async () => {
    const s = site(10_000, (page, attempt) =>
      page === 28 && attempt === 1 ? REDIRECT : null,
    );
    const w = await s.run(40);
    expect(w.rows.size).toBe(40 * PAGE_SIZE);
    expect(w.skippedPages).toEqual([]);
    // Retried once, after the first long wait, bypassing the cache.
    expect(s.sleeps).toEqual([ANOMALY_RETRY_WAITS_MS[0]]);
    expect(s.calls.filter((c) => c.page === 28)).toEqual([
      { page: 28, refetch: false },
      { page: 28, refetch: true },
    ]);
  });

  test("a transient EMPTY page mid-walk is retried too", async () => {
    const s = site(200, (page, attempt) =>
      page === 3 && attempt <= 2 ? "empty" : null,
    );
    const w = await s.run();
    expect(w.rows.size).toBe(200);
    expect(w.complete).toBe(true);
    expect(s.sleeps).toEqual(ANOMALY_RETRY_WAITS_MS.slice(0, 2));
  });

  test("a page that stays bad is skipped and recorded; the walk carries on", async () => {
    const s = site(200, (page) => (page === 4 ? REDIRECT : null));
    const w = await s.run();
    expect(w.skippedPages).toEqual([4]);
    expect(w.rows.size).toBe(180);
    expect(w).toMatchObject({ complete: false, aborted: false });
    expect(s.sleeps).toEqual(ANOMALY_RETRY_WAITS_MS);
  });

  test("three bad pages in a row abort the walk instead of grinding through a dead site", async () => {
    const s = site(10_000, (page) => (page >= 5 ? REDIRECT : null));
    const w = await s.run();
    expect(w.skippedPages).toEqual([5, 6, 7]);
    expect(w).toMatchObject({ aborted: true, complete: false });
    expect(w.rows.size).toBe(80);
  });

  test("a redirect on page 1 is an anomaly, not an empty island", async () => {
    const s = site(100, (page, attempt) =>
      page === 1 && attempt === 1 ? REDIRECT : null,
    );
    const w = await s.run();
    expect(w.rows.size).toBe(100);
    expect(w.complete).toBe(true);
  });

  test("an island with zero listings ends at once", async () => {
    const s = site(0);
    const w = await s.run();
    expect(w).toMatchObject({ complete: true, totalCount: 0 });
    expect(s.calls).toHaveLength(1);
    expect(s.sleeps).toEqual([]);
  });

  test("the last page emptying out mid-walk is a legitimate end", async () => {
    // Count said 5 pages; by the time we ask for page 5 it has nothing.
    const s = site(95, (page) => (page === 5 ? "empty" : null));
    const w = await s.run();
    expect(w.rows.size).toBe(80);
    expect(w.complete).toBe(true);
    expect(s.sleeps).toEqual([]);
  });

  test("hitting the site's page cap is reported as capped, not complete", async () => {
    const s = site(20_000, () => null, 499);
    const w = await s.run();
    expect(s.calls).toHaveLength(499);
    expect(w.rows.size).toBe(499 * PAGE_SIZE);
    expect(w).toMatchObject({
      capped: true,
      complete: false,
      skippedPages: [],
    });
  });

  test("an unparseable page counts as a parse failure and is retried", async () => {
    const s = site(60, (page, attempt) =>
      page === 2 && attempt === 1
        ? { kind: "ok", html: "not json", path: "", fromCache: false }
        : null,
    );
    const w = await s.run();
    expect(w.rows.size).toBe(60);
    expect(s.counters.parseFailures).toBe(1);
  });
});
