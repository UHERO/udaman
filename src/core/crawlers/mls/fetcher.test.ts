import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createFetcher,
  DEFAULT_USER_AGENT,
  MlsFetchAbort,
  MlsFetchError,
  type FetcherOptions,
} from "./fetcher";
import { detailPath, listPagePath, readHtml, writeHtml } from "./nas-cache";
import type { ListQuery } from "./types";

const SITE = "testsite";
const DATE = "2026-09-18";
const PAGE = `<html>${"x".repeat(2_000)}</html>`;
const Q: ListQuery = { island: "oahu", statusSet: "active", page: 1 };
const mls = (n: number) => String(202600000 + n);
const url = (n: number) => `https://example.test/?/${mls(n)}`;

let root: string;
let savedEnv: string | undefined;

beforeEach(async () => {
  savedEnv = process.env.MLS_NAS_PATH;
  root = await mkdtemp(path.join(tmpdir(), "mls-fetch-test-"));
  process.env.MLS_NAS_PATH = root;
});

afterEach(async () => {
  if (savedEnv === undefined) delete process.env.MLS_NAS_PATH;
  else process.env.MLS_NAS_PATH = savedEnv;
  await rm(root, { recursive: true, force: true });
});

type Reply = Response | Error | (() => Response | Promise<Response>);

/**
 * Fake network + fake clock. No real request is ever made and no real time
 * passes: sleep advances the clock, each request costs `latencyMs` of it.
 */
function harness(
  replies: Reply[] | ((url: string) => Reply),
  extra: Partial<FetcherOptions> = {},
) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const calls: { url: string; init: RequestInit | undefined; at: number }[] =
    [];
  const events: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const latencyMs = 50;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    calls.push({ url: u, init, at: clock });
    events.push(`fetch ${u}`);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      // Yield for real so overlapping callers would actually interleave.
      await new Promise((r) => setTimeout(r, 1));
      clock += latencyMs;
      const reply =
        typeof replies === "function" ? replies(u) : replies[calls.length - 1];
      if (reply === undefined)
        throw new Error(`unexpected request #${calls.length}`);
      if (reply instanceof Error) throw reply;
      return typeof reply === "function" ? await reply() : reply;
    } finally {
      inFlight--;
      events.push(`done ${u}`);
    }
  }) as typeof fetch;

  const fetcher = createFetcher({
    site: SITE,
    minDelayMs: 1_000,
    fetchImpl,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
      events.push(`sleep ${ms}`);
      clock += ms;
    },
    nowImpl: () => clock,
    randomImpl: () => 0.5, // jitter = 500
    ...extra,
  });

  return { fetcher, sleeps, calls, events, maxInFlight: () => maxInFlight };
}

const ok = () => new Response(PAGE, { status: 200 });
const status = (code: number, headers?: Record<string, string>) =>
  new Response("nope", { status: code, headers });

describe("politeness", () => {
  test("waits minDelay + jitter between network requests, not before the first", async () => {
    const h = harness(() => ok());
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(h.sleeps).toEqual([]);

    await h.fetcher.fetchDetail(url(2), mls(2), DATE);
    await h.fetcher.fetchList("https://example.test/list", Q, DATE);
    expect(h.sleeps).toEqual([1_500, 1_500]);

    // Measured from when the previous request FINISHED to the next one starting.
    expect(h.calls[1].at - (h.calls[0].at + 50)).toBe(1_500);
    expect(h.fetcher.stats()).toEqual({
      requests: 3,
      cacheHits: 0,
      retries: 0,
    });
  });

  test("jitter spans 0..1000 ms on top of minDelayMs", async () => {
    const randoms = [0, 0.999999];
    const h = harness(() => ok(), { randomImpl: () => randoms.shift() ?? 0 });
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    await h.fetcher.fetchDetail(url(2), mls(2), DATE);
    await h.fetcher.fetchDetail(url(3), mls(3), DATE);
    expect(h.sleeps).toEqual([1_000, 2_000]);
  });

  test("time the caller already spent counts toward the delay", async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const fetcher = createFetcher({
      site: SITE,
      minDelayMs: 1_000,
      fetchImpl: (async () => ok()) as unknown as typeof fetch,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      nowImpl: () => clock,
      randomImpl: () => 0,
    });
    await fetcher.fetchDetail(url(1), mls(1), DATE);
    clock += 400; // caller parsed for 400ms
    await fetcher.fetchDetail(url(2), mls(2), DATE);
    clock += 5_000; // caller was slow: nothing owed
    await fetcher.fetchDetail(url(3), mls(3), DATE);
    expect(sleeps).toEqual([600]);
  });

  test("sends the identifying User-Agent and never follows redirects", async () => {
    const h = harness(() => ok());
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    const init = h.calls[0].init!;
    expect(init.redirect).toBe("manual");
    expect(new Headers(init.headers).get("user-agent")).toBe(
      DEFAULT_USER_AGENT,
    );
    expect(DEFAULT_USER_AGENT).toBe(
      "UHERO-research-scraper/1.0 (University of Hawaii Economic Research Organization; uhero.hawaii.edu)",
    );

    const custom = harness(() => ok(), { userAgent: "custom/2" });
    await custom.fetcher.fetchDetail(url(1), mls(1), "2026-09-19");
    expect(new Headers(custom.calls[0].init!.headers).get("user-agent")).toBe(
      "custom/2",
    );
  });

  test("concurrent callers are serialized: one request in flight, delay between each", async () => {
    const h = harness(() => ok());
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => h.fetcher.fetchDetail(url(n), mls(n), DATE)),
    );
    expect(results.every((r) => r.kind === "ok")).toBe(true);
    expect(h.maxInFlight()).toBe(1);
    expect(h.calls.map((c) => c.url)).toEqual([1, 2, 3, 4, 5].map(url));
    expect(h.sleeps).toEqual([1_500, 1_500, 1_500, 1_500]);
    // Strict fetch → done → sleep → fetch ordering; no two fetches adjacent.
    expect(h.events.slice(0, 5)).toEqual([
      `fetch ${url(1)}`,
      `done ${url(1)}`,
      "sleep 1500",
      `fetch ${url(2)}`,
      `done ${url(2)}`,
    ]);
  });

  test("a failed call does not wedge the queue behind it", async () => {
    const h = harness((u) => (u === url(1) ? status(404) : ok()));
    const [a, b] = await Promise.allSettled([
      h.fetcher.fetchDetail(url(1), mls(1), DATE),
      h.fetcher.fetchDetail(url(2), mls(2), DATE),
    ]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("fulfilled");
    expect(h.maxInFlight()).toBe(1);
  });
});

describe("cache-through", () => {
  test("writes the page to the cache before returning", async () => {
    const h = harness(() => ok());
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r).toEqual({
      kind: "ok",
      html: PAGE,
      path: detailPath(SITE, mls(1), DATE),
      fromCache: false,
    });
    expect(await readHtml(detailPath(SITE, mls(1), DATE))).toBe(PAGE);
  });

  test("a cache hit skips both the network and the sleep", async () => {
    const h = harness(() => ok());
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    const again = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(again).toEqual({
      kind: "ok",
      html: PAGE,
      path: detailPath(SITE, mls(1), DATE),
      fromCache: true,
    });
    expect(h.calls.length).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(h.fetcher.stats()).toEqual({
      requests: 1,
      cacheHits: 1,
      retries: 0,
    });
  });

  test("a fresh fetcher is served by a previous run's cache", async () => {
    await writeHtml(listPagePath(SITE, DATE, Q), PAGE);
    const h = harness([]);
    const r = await h.fetcher.fetchList("https://example.test/list", Q, DATE);
    expect(r.kind === "ok" && r.fromCache).toBe(true);
    expect(h.calls.length).toBe(0);
  });

  test("detail snapshots are per date; list pages per run date and page", async () => {
    const h = harness(() => ok());
    await h.fetcher.fetchDetail(url(1), mls(1), "2026-09-17");
    await h.fetcher.fetchDetail(url(1), mls(1), "2026-09-18");
    expect(h.calls.length).toBe(2);

    await h.fetcher.fetchList("https://example.test/list", Q, "2026-09-17");
    await h.fetcher.fetchList("https://example.test/list", Q, "2026-09-18");
    await h.fetcher.fetchList(
      "https://example.test/list2",
      { ...Q, page: 2 },
      "2026-09-18",
    );
    await h.fetcher.fetchList("https://example.test/list", Q, "2026-09-18");
    expect(h.calls.length).toBe(5);
    expect(h.fetcher.stats().cacheHits).toBe(1);
  });

  test("refetch ignores the cache and overwrites it", async () => {
    await writeHtml(
      detailPath(SITE, mls(1), DATE),
      `<html>${"old".repeat(500)}</html>`,
    );
    const h = harness(() => ok(), { refetch: true });
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind === "ok" && !r.fromCache).toBe(true);
    expect(h.calls.length).toBe(1);
    expect(await readHtml(detailPath(SITE, mls(1), DATE))).toBe(PAGE);
  });

  test("concurrent requests for the same page cost one request", async () => {
    const h = harness(() => ok());
    const [a, b] = await Promise.all([
      h.fetcher.fetchDetail(url(1), mls(1), DATE),
      h.fetcher.fetchDetail(url(1), mls(1), DATE),
    ]);
    expect(h.calls.length).toBe(1);
    expect(a.kind === "ok" && !a.fromCache).toBe(true);
    expect(b.kind === "ok" && b.fromCache).toBe(true);
  });
});

describe("followRedirects / goneStatuses (opt-in, per site)", () => {
  test("follows a same-origin 301 as a second, delayed request and caches under the asked-for key", async () => {
    const h = harness(
      [status(301, { Location: "/listing/123-new-slug/" }), ok()],
      { followRedirects: true },
    );
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind).toBe("ok");
    expect(h.calls.map((c) => c.url)).toEqual([
      url(1),
      "https://example.test/listing/123-new-slug/",
    ]);
    // The hop waited out the politeness delay like any other request.
    expect(h.sleeps).toEqual([1_500]);
    const again = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(again).toMatchObject({ kind: "ok", fromCache: true });
    expect(h.calls).toHaveLength(2);
  });

  test("does not follow a redirect off the origin", async () => {
    const h = harness([status(302, { Location: "https://elsewhere.test/x" })], {
      followRedirects: true,
    });
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r).toEqual({
      kind: "redirect",
      location: "https://elsewhere.test/x",
    });
    expect(h.calls).toHaveLength(1);
  });

  test("gives up after three hops", async () => {
    let n = 0;
    const h = harness(() => status(301, { Location: `/hop-${++n}/` }), {
      followRedirects: true,
    });
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind).toBe("redirect");
    expect(h.calls).toHaveLength(4);
  });

  test("a gone status is an answer: not retried, not cached, no breaker strike", async () => {
    const h = harness(() => status(404), { goneStatuses: [404] });
    for (let i = 1; i <= 7; i++) {
      expect(await h.fetcher.fetchDetail(url(i), mls(i), DATE)).toEqual({
        kind: "gone",
        status: 404,
      });
    }
    expect(h.calls).toHaveLength(7);
    expect(h.fetcher.stats().retries).toBe(0);
  });

  test("without goneStatuses a 404 is still a failure", async () => {
    const h = harness(() => status(404));
    await expect(h.fetcher.fetchDetail(url(1), mls(1), DATE)).rejects.toThrow(
      MlsFetchError,
    );
  });
});

describe("redirects", () => {
  test("302 → redirect result, not cached, not retried", async () => {
    const h = harness([
      status(302, { Location: "/PropertySearch/Error.aspx" }),
      ok(),
    ]);
    const q = { ...Q, page: 500 };
    const r = await h.fetcher.fetchList("https://example.test/p500", q, DATE);
    expect(r).toEqual({
      kind: "redirect",
      location: "/PropertySearch/Error.aspx",
    });
    expect(h.calls.length).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(await readHtml(listPagePath(SITE, DATE, q))).toBeNull();
    expect(h.fetcher.stats()).toEqual({
      requests: 1,
      cacheHits: 0,
      retries: 0,
    });

    // Asking again goes back to the network — nothing was cached.
    const again = await h.fetcher.fetchList(
      "https://example.test/p500",
      q,
      DATE,
    );
    expect(again.kind).toBe("ok");
    expect(h.calls.length).toBe(2);
  });

  test("any 3xx counts, with or without a Location header", async () => {
    const h = harness([
      status(301, { Location: "https://x.test/" }),
      status(307),
    ]);
    expect(await h.fetcher.fetchDetail(url(1), mls(1), DATE)).toEqual({
      kind: "redirect",
      location: "https://x.test/",
    });
    expect(await h.fetcher.fetchDetail(url(2), mls(2), DATE)).toEqual({
      kind: "redirect",
      location: null,
    });
  });
});

describe("retry", () => {
  test("503 is retried with backoff, then succeeds", async () => {
    const h = harness([status(503), status(503), ok()]);
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind === "ok" && !r.fromCache).toBe(true);
    expect(h.sleeps).toEqual([5_000, 20_000]);
    expect(h.fetcher.stats()).toEqual({
      requests: 3,
      cacheHits: 0,
      retries: 2,
    });
    expect(await readHtml(detailPath(SITE, mls(1), DATE))).toBe(PAGE);
  });

  test("backoff runs 5s → 20s → 60s, then MlsFetchError", async () => {
    const h = harness(() => status(500));
    const err = await h.fetcher
      .fetchDetail(url(1), mls(1), DATE)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MlsFetchError);
    expect((err as MlsFetchError).status).toBe(500);
    expect((err as MlsFetchError).attempts).toBe(4);
    expect((err as MlsFetchError).url).toBe(url(1));
    expect(h.sleeps).toEqual([5_000, 20_000, 60_000]);
    expect(h.fetcher.stats()).toEqual({
      requests: 4,
      cacheHits: 0,
      retries: 3,
    });
    expect(await readHtml(detailPath(SITE, mls(1), DATE))).toBeNull();
  });

  test("network errors and 429 are retried too", async () => {
    const h = harness([new TypeError("socket hang up"), status(429), ok()]);
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind).toBe("ok");
    expect(h.sleeps).toEqual([5_000, 20_000]);
  });

  test("Retry-After is honoured when larger than the backoff, capped at 5 min", async () => {
    const h = harness([
      status(429, { "Retry-After": "2" }), // smaller → backoff wins
      status(429, { "Retry-After": "90" }), // larger → wins
      status(503, { "Retry-After": "86400" }), // capped
      ok(),
    ]);
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(h.sleeps).toEqual([5_000, 90_000, 300_000]);
  });

  test("Retry-After as an HTTP date", async () => {
    // Harness clock starts at 1_000_000 ms and the request costs 50.
    const at = new Date(1_000_000 + 50 + 45_000).toUTCString();
    const h = harness([status(503, { "Retry-After": at }), ok()]);
    await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    // HTTP dates have 1s resolution.
    expect(h.sleeps.length).toBe(1);
    expect(h.sleeps[0]).toBeGreaterThan(43_000);
    expect(h.sleeps[0]).toBeLessThanOrEqual(45_000);
  });

  test("other non-200 statuses throw immediately", async () => {
    for (const code of [403, 404, 410]) {
      const h = harness([status(code)]);
      const err = await h.fetcher
        .fetchDetail(url(1), mls(1), DATE)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MlsFetchError);
      expect((err as MlsFetchError).status).toBe(code);
      expect((err as MlsFetchError).attempts).toBe(1);
      expect(h.calls.length).toBe(1);
      expect(h.sleeps).toEqual([]);
    }
  });

  test("a 200 under 1,000 bytes is a failure: retried, never cached", async () => {
    const stub = () => new Response("<html>error</html>", { status: 200 });
    const h = harness([stub(), ok()]);
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind === "ok" && r.html).toBe(PAGE);
    expect(h.sleeps).toEqual([5_000]);

    const always = harness(() => stub());
    await expect(
      always.fetcher.fetchDetail(url(2), mls(2), DATE),
    ).rejects.toBeInstanceOf(MlsFetchError);
    expect(await readHtml(detailPath(SITE, mls(2), DATE))).toBeNull();
  });

  test("an undersized file already in the cache is not served", async () => {
    await writeHtml(detailPath(SITE, mls(1), DATE), "truncated");
    const h = harness(() => ok());
    const r = await h.fetcher.fetchDetail(url(1), mls(1), DATE);
    expect(r.kind === "ok" && !r.fromCache).toBe(true);
    expect(await readHtml(detailPath(SITE, mls(1), DATE))).toBe(PAGE);
  });
});

describe("circuit breaker", () => {
  test("the 5th consecutive failed URL throws MlsFetchAbort and the fetcher stays tripped", async () => {
    const h = harness(() => status(503));
    for (let n = 1; n <= 4; n++) {
      const err = await h.fetcher
        .fetchDetail(url(n), mls(n), DATE)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MlsFetchError);
    }
    const fifth = await h.fetcher
      .fetchDetail(url(5), mls(5), DATE)
      .catch((e: unknown) => e);
    expect(fifth).toBeInstanceOf(MlsFetchAbort);
    expect((fifth as MlsFetchAbort).consecutiveFailures).toBe(5);
    expect((fifth as MlsFetchAbort).cause).toBeInstanceOf(MlsFetchError);
    expect(h.calls.length).toBe(20); // 5 URLs × 4 attempts

    // Tripped: no further request is sent.
    await expect(
      h.fetcher.fetchDetail(url(6), mls(6), DATE),
    ).rejects.toBeInstanceOf(MlsFetchAbort);
    expect(h.calls.length).toBe(20);
  });

  test("a success resets the streak", async () => {
    const h = harness((u) => (u === url(3) ? ok() : status(404)));
    const kinds: string[] = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      await h.fetcher.fetchDetail(url(n), mls(n), DATE).then(
        (r) => kinds.push(r.kind),
        (e: Error) => kinds.push(e.name),
      );
    }
    // 2 failures, success, then 4 more failures: never reaches 5 in a row.
    expect(kinds).toEqual([
      "MlsFetchError",
      "MlsFetchError",
      "ok",
      "MlsFetchError",
      "MlsFetchError",
      "MlsFetchError",
      "MlsFetchError",
    ]);
  });

  test("redirects and cache hits neither trip nor reset it", async () => {
    await writeHtml(detailPath(SITE, mls(50), DATE), PAGE);
    const h = harness((u) => (u === url(3) ? status(302) : status(404)));
    const names: string[] = [];
    for (const n of [1, 2, 3, 50, 4, 5, 6]) {
      await h.fetcher.fetchDetail(url(n), mls(n), DATE).then(
        (r) => names.push(r.kind),
        (e: Error) => names.push(e.name),
      );
    }
    expect(names).toEqual([
      "MlsFetchError",
      "MlsFetchError",
      "redirect",
      "ok",
      "MlsFetchError",
      "MlsFetchError",
      "MlsFetchAbort",
    ]);
  });

  test("cached pages are still served after the breaker trips", async () => {
    await writeHtml(detailPath(SITE, mls(50), DATE), PAGE);
    const h = harness(() => status(404));
    for (let n = 1; n <= 5; n++) {
      await h.fetcher.fetchDetail(url(n), mls(n), DATE).catch(() => {});
    }
    const r = await h.fetcher.fetchDetail(url(50), mls(50), DATE);
    expect(r.kind === "ok" && r.fromCache).toBe(true);
  });
});
