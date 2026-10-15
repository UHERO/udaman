import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { readExtract } from "../../extract-file";
import type { HttpFetch } from "../../http";
import { fileRawStore } from "../../raw-store";
import { runFetch } from "../../run";
import type { RunEnv } from "../../run";
import { MemoryDb } from "../../testing/memory-db";
import { fredSource } from "./index";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-fred-"));
  process.env.DATA_DIR = root;
  process.env.API_KEY_FRED ??= "test-key";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Obs = { date: string; value: string };

/**
 * A fake FRED v1 endpoint: `data["ID/freq/agg"]` is what FRED returns for
 * that request; unknown ids get FRED's 400. Every response carries
 * today's realtime stamps, like FRED.
 */
function fakeFred(
  data: Record<string, Obs[]>,
  requests: string[],
  stamp: { today: string },
): HttpFetch {
  return async (url) => {
    const q = new URL(url).searchParams;
    const key = `${q.get("series_id")}/${q.get("frequency")}/${q.get("aggregation_method")}`;
    requests.push(key);
    const obs = data[key];
    if (!obs) {
      return new Response(
        JSON.stringify({
          error_code: 400,
          error_message: "Bad Request.  The series does not exist.",
        }),
        { status: 400 },
      );
    }
    return new Response(
      JSON.stringify({
        realtime_start: stamp.today,
        realtime_end: stamp.today,
        units: "lin",
        count: obs.length,
        offset: 0,
        limit: 100000,
        observations: obs.map((o) => ({
          realtime_start: stamp.today,
          realtime_end: stamp.today,
          ...o,
        })),
      }),
    );
  };
}

function fredSetup(
  data: Record<string, Obs[]>,
  filters: Array<Record<string, string>>,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const stamp = { today: "2026-10-15" };
  const dl = db.addDownloader({
    handle: "fred",
    source_key: "fred",
    strategy: "custom",
    config: {},
  });
  db.addExtractor({ handle: "fred", source_key: "fred", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("fred", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeFred(data, requests, stamp),
    sources: { fred: fredSource },
    sleep: async () => {},
  };
  return { db, env, requests, stamp };
}

describe("fred source", () => {
  test("one artifact per series/frequency/aggregation; realtime stamps don't make vintages", async () => {
    const data: Record<string, Obs[]> = {
      "MORTGAGE30US/q/avg": [
        { date: "2026-01-01", value: "6.1" },
        { date: "2026-04-01", value: "." },
        { date: "2026-07-01", value: "6.3" },
        { date: "2026-10-01", value: "." },
      ],
      "MORTGAGE30US/q/eop": [{ date: "2026-07-01", value: "6.25" }],
      "SP500/m/avg": [{ date: "2026-09-01", value: "6500.5" }],
    };
    const { db, env, requests, stamp } = fredSetup(data, [
      { series_id: "MORTGAGE30US", frequency: "Q" },
      { series_id: "mortgage30us", frequency: "Q", aggregation: "avg" },
      { series_id: "MORTGAGE30US", frequency: "Q", aggregation: "eop" },
      { series_id: "SP500", frequency: "M" },
      { series_id: "NOSUCH", frequency: "M" },
      { series_id: "GDP" },
      { series_id: "GDP", frequency: "Q", aggregation: "median" },
    ]);

    const first = await runFetch("fred", { env });
    expect(first.status).toBe("ok");
    expect(requests).toEqual([
      "MORTGAGE30US/q/avg",
      "MORTGAGE30US/q/eop",
      "NOSUCH/m/avg",
      "SP500/m/avg",
    ]);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "MORTGAGE30US/Q/avg",
      "MORTGAGE30US/Q/eop",
      "SP500/M/avg",
    ]);
    const warnings = first.stats.warnings as string[];
    expect(warnings.some((w) => w.startsWith("NOSUCH/M/avg: HTTP 400"))).toBe(
      true,
    );
    expect(warnings.some((w) => w.includes("no frequency"))).toBe(true);
    expect(warnings.some((w) => w.includes("aggregation must be"))).toBe(true);
    // the API key never reaches a run record
    expect(warnings.join(" ")).not.toContain(process.env.API_KEY_FRED!);
    expect(warnings.join(" ")).toContain("api_key=***");
    const stored = readFileSync(
      join(root, db.artifacts[0].storage_path),
      "utf8",
    );
    expect(stored).not.toContain("realtime");

    const ex = first.extractions[0];
    expect(ex.status).toBe("ok");
    const outPath = join(root, db.extractionRun(ex.runId!).outputPath!);
    const out = readExtract(outPath);
    expect(out.dims).toEqual(["series_id", "frequency", "aggregation"]);
    expect(
      out.rows.map(
        (r) =>
          `${r.dims.series_id} ${r.dims.frequency} ${r.dims.aggregation} ${r.date} ${r.value}`,
      ),
    ).toEqual([
      "MORTGAGE30US Q avg 2026-01-01 6.1",
      "MORTGAGE30US Q avg 2026-07-01 6.3",
      "MORTGAGE30US Q eop 2026-07-01 6.25",
      "SP500 M avg 2026-09-01 6500.5",
    ]);
    // the hole inside the range is a blank missing period; the trailing
    // incomplete quarter is outside the range
    const missing = readFileSync(
      outPath.replace(/\.csv$/, ".missing.csv"),
      "utf8",
    );
    expect(missing).toContain("2026-04-01");
    expect(missing).not.toContain("2026-10-01");

    // next day: same data, new realtime stamps → nothing changed
    stamp.today = "2026-10-16";
    const second = await runFetch("fred", { env });
    expect(second.status).toBe("unchanged");

    // a revision → a new vintage of that key only
    data["SP500/m/avg"][0].value = "6501";
    const third = await runFetch("fred", { env });
    expect(third.status).toBe("ok");
    expect(db.artifacts).toHaveLength(4);
  });

  test("a server error fails that key and the fetch", async () => {
    const { env, db } = fredSetup({}, [{ series_id: "GDP", frequency: "Q" }]);
    env.http = async () => new Response("boom", { status: 500 });
    const out = await runFetch("fred", { env });
    expect(out.status).toBe("failed");
    expect(out.extractions).toHaveLength(0);
    expect(db.artifacts).toHaveLength(0);
  });
});
