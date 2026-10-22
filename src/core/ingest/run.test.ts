import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { readExtract } from "./extract-file";
import type { HttpFetch } from "./http";
import { fileRawStore } from "./raw-store";
import { runExtract, runFetch } from "./run";
import type { RunEnv } from "./run";
import { formatPattern, periodsBetween } from "./strategies";
import { MemoryDb } from "./testing/memory-db";
import type { ExtractRow, SourceModule } from "./types";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-test-"));
  process.env.DATA_DIR = root;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** url → response; a function value is called on each request. */
type Routes = Record<
  string,
  | { status?: number; body: string; headers?: Record<string, string> }
  | (() => { status?: number; body: string; headers?: Record<string, string> })
>;

function fakeHttp(routes: Routes, seen: string[] = []): HttpFetch {
  return async (url, init) => {
    seen.push(`${init?.method ?? "GET"} ${url}`);
    const r = routes[url];
    const res = typeof r === "function" ? r() : r;
    if (!res) return new Response("not found", { status: 404 });
    return new Response(res.body, {
      status: res.status ?? 200,
      headers: res.headers,
    });
  };
}

/** label,date,value per line → one series per label. */
const csvSource: SourceModule = {
  key: "csv_test",
  description: "test",
  version: 1,
  dimensions: () => ["label"],
  parse(inputs) {
    const rows: ExtractRow[] = [];
    for (const input of inputs) {
      for (const line of readFileSync(input.path, "utf8").trim().split("\n")) {
        const [label, date, value] = line.split(",");
        if (label === "THROW") throw new Error("cannot read this file");
        rows.push({ dims: { label }, date, value: Number(value) });
      }
    }
    return { rows };
  },
};

function setup(
  routes: Routes,
  downloader: {
    strategy: string;
    config: Record<string, unknown>;
    source_key?: string;
  },
  extractorConfig: Record<string, unknown> = {},
  extraSources: SourceModule[] = [],
) {
  const db = new MemoryDb();
  const seen: string[] = [];
  const dl = db.addDownloader({ handle: "test_dl", ...downloader });
  db.addExtractor(
    { handle: "test_ex", source_key: "csv_test", config: extractorConfig },
    [{ downloaderId: dl.id }],
  );
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeHttp(routes, seen),
    sources: Object.fromEntries(
      [csvSource, ...extraSources].map((s) => [s.key, s]),
    ),
    sleep: async () => {},
  };
  return { db, env, seen };
}

describe("static_url fetch → extract", () => {
  test("stores the file, extracts it, and skips unchanged inputs", async () => {
    let body = "A,2025-01-01,1\nA,2025-02-01,2\nB,2025-01-01,3\n";
    const { db, env } = setup(
      { "https://x.test/data.csv": () => ({ body }) },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );

    const first = await runFetch("test_dl", { env });
    expect(first.status).toBe("ok");
    expect(first.extractions[0].status).toBe("ok");
    expect(first.extractions[0].seriesCount).toBe(2);
    const run = db.extractionRun(first.extractions[0].runId!);
    const out = readExtract(join(root, run.outputPath!));
    expect(out.dims).toEqual(["label"]);
    expect(out.rows.map((r) => `${r.dims.label} ${r.date} ${r.value}`)).toEqual(
      ["A 2025-01-01 1", "A 2025-02-01 2", "B 2025-01-01 3"],
    );
    expect(db.artifacts).toHaveLength(1);
    expect(db.artifacts[0].artifact_key).toBe("data.csv");

    // same bytes: unchanged fetch, no new vintage, parse skipped
    const second = await runFetch("test_dl", { env });
    expect(second.status).toBe("unchanged");
    expect(second.extractions[0].status).toBe("unchanged");
    expect(db.artifacts).toHaveLength(1);
    expect(db.extractionRuns).toHaveLength(1); // fetch-triggered skips are not recorded

    // a revision is a new vintage and a new extract
    body = "A,2025-01-01,1\nA,2025-02-01,2.5\nB,2025-01-01,3\n";
    const third = await runFetch("test_dl", { env });
    expect(third.status).toBe("ok");
    expect(third.extractions[0].status).toBe("ok");
    expect(db.artifacts).toHaveLength(2);
    expect(db.extractionRuns).toHaveLength(2);

    // reverting to the first content reuses its row and is a change again
    body = "A,2025-01-01,1\nA,2025-02-01,2\nB,2025-01-01,3\n";
    const fourth = await runFetch("test_dl", { env });
    expect(fourth.status).toBe("ok");
    expect(db.artifacts).toHaveLength(2);

    // a manual extract with unchanged inputs records an 'unchanged' run
    const manual = await runExtract("test_ex", { env });
    expect(manual.status).toBe("unchanged");
    expect(db.extractionRun(manual.runId!).status).toBe("unchanged");
    // --force parses anyway
    expect((await runExtract("test_ex", { env, force: true })).status).toBe(
      "ok",
    );
  });

  test("an HTML page instead of the file fails the fetch and extracts nothing", async () => {
    const { db, env } = setup(
      {
        "https://x.test/data.csv": {
          body: "<!DOCTYPE html><html><body>Not found</body></html>",
        },
      },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    const out = await runFetch("test_dl", { env });
    expect(out.status).toBe("failed");
    expect(out.message).toMatch(/HTML page/);
    expect(out.extractions).toHaveLength(0);
    expect(db.artifacts).toHaveLength(0);
  });

  test("a parse exception fails the run without an output; the last ok output stays", async () => {
    let body = "A,2025-01-01,1\n";
    const { db, env } = setup(
      { "https://x.test/data.csv": () => ({ body }) },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    await runFetch("test_dl", { env });
    body = "THROW,2025-01-01,1\n";
    const out = await runFetch("test_dl", { env });
    expect(out.extractions[0].status).toBe("failed");
    expect(out.extractions[0].message).toMatch(/cannot read this file/);
    const failed = db.extractionRun(out.extractions[0].runId!);
    expect(failed.outputPath).toBeNull();
    expect((await db.latestOkExtraction(1))!.id).toBe(1);
  });

  test("hard validation failures cannot be published", async () => {
    const { db, env } = setup(
      {
        "https://x.test/data.csv": {
          body: "A,2025-01-01,1\nA,2025-01-01,2\nB,2025-13-01,3\nC,2025-01-01,x\n",
        },
      },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    const out = await runFetch("test_dl", { env });
    const ex = out.extractions[0];
    expect(ex.status).toBe("failed");
    const failed = ex.failedChecks!.map((c) => c.check).sort();
    expect(failed).toEqual(["dates", "duplicates", "values"]);
    const run = db.extractionRun(ex.runId!);
    expect(run.outputPath).not.toBeNull(); // written, for inspection
    expect(run.canAccept()).toBe(false);
    expect(await db.latestOkExtraction(1)).toBeNull();
  });

  test("a disappeared series is a soft failure that can be accepted", async () => {
    let body = "A,2025-01-01,1\nB,2025-01-01,2\n";
    const { db, env } = setup(
      { "https://x.test/data.csv": () => ({ body }) },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    await runFetch("test_dl", { env });
    body = "A,2025-01-01,1\nA,2025-02-01,5\n";
    const out = await runFetch("test_dl", { env });
    const ex = out.extractions[0];
    expect(ex.status).toBe("failed");
    expect(ex.failedChecks!.map((c) => c.check)).toEqual(["disappeared"]);
    expect(ex.failedChecks![0].details).toEqual(["B"]);
    expect(db.extractionRun(ex.runId!).canAccept()).toBe(true);
  });

  test("allowDisappeared and maxChange", async () => {
    let body = "A,2025-01-01,100\nB,2025-01-01,2\n";
    const { env } = setup(
      { "https://x.test/data.csv": () => ({ body }) },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
      { checks: { allowDisappeared: true, maxChange: 0.5 } },
    );
    await runFetch("test_dl", { env });
    body = "A,2025-01-01,200\n";
    const ex = (await runFetch("test_dl", { env })).extractions[0];
    expect(ex.status).toBe("failed");
    expect(ex.failedChecks!.map((c) => c.check)).toEqual(["changes"]);
  });

  test("date patterns: one key per period, older periods final, newest 404 is a warning", async () => {
    const { db, env, seen } = setup(
      {
        "https://x.test/2024.csv": { body: "A,2024-01-01,1\n" },
        "https://x.test/2025.csv": { body: "A,2025-01-01,2\n" },
      },
      {
        strategy: "static_url",
        config: {
          url: "https://x.test/%Y.csv",
          key: "%Y",
          periods: { frequency: "year", start: "2023", end: "2026" },
          liveRecent: 2,
          optionalRecent: 1,
        },
      },
    );
    const out = await runFetch("test_dl", { env });
    // 2026 (newest) 404 = warning; 2023 404 = a failed key
    expect(out.status).toBe("failed");
    expect(out.stats.warnings).toEqual(["2026: not published yet (404)"]);
    expect(
      (out.stats.keysFailed as Array<{ key: string }>).map((k) => k.key),
    ).toEqual(["2023"]);
    const keys = db.artifacts.map((a) => [a.artifact_key, Boolean(a.final)]);
    expect(keys).toEqual([
      ["2025", false],
      ["2024", true],
    ]);
    // the final 2024 key is not requested again
    seen.length = 0;
    await runFetch("test_dl", { env });
    expect(seen).not.toContain("GET https://x.test/2024.csv");
    expect(seen).toContain("GET https://x.test/2025.csv");
  });

  test("a 5xx is retried with backoff before the key fails", async () => {
    let calls = 0;
    const { env } = setup(
      {
        "https://x.test/data.csv": () =>
          ++calls < 3
            ? { status: 503, body: "busy" }
            : { body: "A,2025-01-01,1\n" },
      },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    const waits: number[] = [];
    env.sleep = async (ms) => {
      waits.push(ms);
    };
    const out = await runFetch("test_dl", { env });
    expect(out.status).toBe("ok");
    expect(calls).toBe(3);
    expect(waits).toEqual([10_000, 30_000]);
    expect(out.stats.requests).toBe(1);
  });

  test("once a key has used up its retries, later keys in the run are not retried", async () => {
    const { env, seen } = setup(
      {
        "https://x.test/2024.csv": { status: 503, body: "busy" },
        "https://x.test/2025.csv": { status: 503, body: "busy" },
      },
      {
        strategy: "static_url",
        config: {
          url: "https://x.test/%Y.csv",
          key: "%Y",
          periods: { frequency: "year", start: "2024", end: "2025" },
        },
      },
    );
    const out = await runFetch("test_dl", { env });
    expect(out.status).toBe("failed");
    expect(
      (out.stats.keysFailed as Array<{ key: string }>).map((k) => k.key),
    ).toEqual(["2025", "2024"]);
    // the first key: 3 attempts; the second: 1
    expect(seen.filter((s) => s.endsWith("2025.csv"))).toHaveLength(3);
    expect(seen.filter((s) => s.endsWith("2024.csv"))).toHaveLength(1);
  });
});

describe("discover_from_page", () => {
  test("follows links by text and downloads the matching files", async () => {
    const landing = `<html><body><a href="/reports/">Monthly Reports</a></body></html>`;
    const reports = `<html><body>
      <a href="files/jobs-2025.csv">Jobs 2025</a>
      <a href="files/jobs-2024.csv">Jobs 2024</a>
      <a href="files/readme.pdf">Read me</a></body></html>`;
    const { db, env } = setup(
      {
        "https://x.test/": { body: landing },
        "https://x.test/reports/": { body: reports },
        "https://x.test/reports/files/jobs-2025.csv": {
          body: "A,2025-01-01,1\n",
        },
        "https://x.test/reports/files/jobs-2024.csv": {
          body: "A,2024-01-01,1\n",
        },
      },
      {
        strategy: "discover_from_page",
        config: {
          page: "https://x.test/",
          via: [{ text: "^Monthly Reports$" }],
          link: { text: "^Jobs", href: "\\.csv$" },
          multiple: true,
        },
      },
    );
    const out = await runFetch("test_dl", { env });
    expect(out.status).toBe("ok");
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "jobs-2024.csv",
      "jobs-2025.csv",
    ]);
    expect(out.extractions[0].status).toBe("ok");
  });

  test("a missing link fails loudly", async () => {
    const { env } = setup(
      { "https://x.test/": { body: "<html><a href='x'>Other</a></html>" } },
      {
        strategy: "discover_from_page",
        config: { page: "https://x.test/", link: { text: "^Jobs" } },
      },
    );
    const out = await runFetch("test_dl", { env });
    expect(out.status).toBe("failed");
    expect(out.message).toMatch(/has the page changed/);
  });
});

describe("custom fetch", () => {
  test("runs the source module's fetch and keeps its state", async () => {
    const custom: SourceModule = {
      ...csvSource,
      key: "custom_test",
      async fetch(ctx) {
        const n = Number(ctx.state.n ?? 0) + 1;
        await ctx.store(
          "one",
          new TextEncoder().encode(`A,2025-0${n}-01,${n}\n`),
        );
        ctx.setState({ n });
      },
    };
    const { db, env } = setup(
      {},
      { strategy: "custom", source_key: "custom_test", config: {} },
      {},
      [custom],
    );
    await runFetch("test_dl", { env });
    await runFetch("test_dl", { env });
    expect(db.downloaders.get(1)!.state).toEqual({ n: 2 });
    expect(db.artifacts).toHaveLength(2);
  });

  test("a busy downloader is not run twice", async () => {
    const { db, env } = setup(
      { "https://x.test/data.csv": { body: "A,2025-01-01,1\n" } },
      { strategy: "static_url", config: { url: "https://x.test/data.csv" } },
    );
    await db.claimDownloader(1);
    expect((await runFetch("test_dl", { env })).status).toBe("busy");
  });
});

describe("date patterns", () => {
  test("formatPattern", () => {
    const d = new Date(Date.UTC(2025, 6, 1));
    expect(formatPattern("TOUR_%b%y_%Y-%m_Q%q %B %%", d)).toBe(
      "TOUR_Jul25_2025-07_Q3 July %",
    );
  });

  test("periodsBetween aligns to period starts", () => {
    const q = periodsBetween(
      new Date(Date.UTC(2024, 10, 15)),
      new Date(Date.UTC(2025, 5, 1)),
      "quarter",
    ).map((d) => d.toISOString().slice(0, 7));
    expect(q).toEqual(["2024-10", "2025-01", "2025-04"]);
  });
});
