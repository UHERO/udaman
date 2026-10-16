import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { readExtract } from "../../extract-file";
import type { HttpFetch } from "../../http";
import { fileRawStore } from "../../raw-store";
import { runFetch } from "../../run";
import type { RunEnv } from "../../run";
import { MemoryDb } from "../../testing/memory-db";
import { blsSource } from "./index";
import { blsPeriodFrequency } from "./parse";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-bls-"));
  process.env.DATA_DIR = root;
  process.env.API_KEY_1_BLS_V2 ??= "test-key";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const THIS_YEAR = new Date().getUTCFullYear();

type Point = { year: string; period: string; value: string };

/**
 * A fake BLS v2 endpoint: `data[id]` lists every point the series has;
 * a request returns the ones inside its window (like BLS), plus the
 * volatile fields a real response carries.
 */
function fakeBls(data: Record<string, Point[]>, requests: string[]): HttpFetch {
  return async (url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      seriesid: string[];
      startyear: string;
      endyear: string;
    };
    requests.push(
      `${body.startyear}-${body.endyear} ${body.seriesid.join(",")}`,
    );
    const series = body.seriesid.map((id) => ({
      seriesID: id,
      data: (data[id] ?? []).filter(
        (p) => p.year >= body.startyear && p.year <= body.endyear,
      ),
    }));
    return new Response(
      JSON.stringify({
        status: "REQUEST_SUCCEEDED",
        responseTime: Math.floor(Math.random() * 500),
        message: body.seriesid
          .filter((id) => !data[id])
          .map((id) => `Series does not exist for Series ${id}`),
        Results: { series },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}

function blsSetup(
  data: Record<string, Point[]>,
  filters: Array<Record<string, string>>,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const dl = db.addDownloader({
    handle: "bls",
    source_key: "bls",
    strategy: "custom",
    config: { refetchYears: 20 },
  });
  db.addExtractor({ handle: "bls", source_key: "bls", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("bls", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeBls(data, requests),
    sources: { bls: blsSource },
    sleep: async () => {},
  };
  return { db, env, requests };
}

const y = (n: number) => String(THIS_YEAR - n);

describe("bls source", () => {
  test("period codes", () => {
    expect(blsPeriodFrequency("M07")).toBe("M");
    expect(blsPeriodFrequency("M13")).toBeNull();
    expect(blsPeriodFrequency("Q04")).toBe("Q");
    expect(blsPeriodFrequency("S02")).toBe("S");
    expect(blsPeriodFrequency("A01")).toBe("A");
  });

  test("walks history once, stores one artifact per series and window, newest vintage wins", async () => {
    const data: Record<string, Point[]> = {
      CUUR0000SA0: [
        { year: y(25), period: "M01", value: "100.0" },
        { year: y(1), period: "M01", value: "200.0" },
        { year: y(1), period: "M13", value: "199.0" },
        { year: y(0), period: "M01", value: "210.0" },
      ],
      LNU04000000: [{ year: y(0), period: "Q01", value: "4.1" }],
    };
    const { db, env, requests } = blsSetup(data, [
      { series_id: "CUUR0000SA0" },
      { series_id: "lnu04000000" },
      { series_id: "NOSUCH00000" },
      { series_id: "not an id" },
    ]);

    const first = await runFetch("bls", { env });
    expect(first.status).toBe("ok");
    // window 1: all three; window 2: only CUUR had data in window 1… and
    // LNU too; window 3: CUUR (had data in window 2)
    expect(requests).toEqual([
      `${y(19)}-${y(0)} CUUR0000SA0,LNU04000000,NOSUCH00000`,
      `${y(39)}-${y(20)} CUUR0000SA0,LNU04000000`,
      `${y(59)}-${y(40)} CUUR0000SA0`,
    ]);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual(
      [
        `CUUR0000SA0/${y(19)}-${y(0)}`,
        `CUUR0000SA0/${y(39)}-${y(20)}`,
        `LNU04000000/${y(19)}-${y(0)}`,
      ].sort(),
    );
    const warnings = first.stats.warnings as string[];
    expect(warnings.some((w) => w.startsWith('"not an id"'))).toBe(true);
    expect(warnings.some((w) => w.startsWith("NOSUCH00000: no data"))).toBe(
      true,
    );
    const history = db.downloaders.get(1)!.state as Record<string, unknown>;
    expect(Object.keys(history.history as object).sort()).toEqual([
      "CUUR0000SA0",
      "LNU04000000",
    ]);

    const ex = first.extractions[0];
    expect(ex.status).toBe("ok");
    const out = readExtract(
      join(root, db.extractionRun(ex.runId!).outputPath!),
    );
    expect(out.dims).toEqual(["series_id", "frequency"]);
    expect(
      out.rows.map(
        (r) => `${r.dims.series_id} ${r.dims.frequency} ${r.date} ${r.value}`,
      ),
    ).toEqual([
      `CUUR0000SA0 M ${y(25)}-01-01 100`,
      `CUUR0000SA0 M ${y(1)}-01-01 200`,
      `CUUR0000SA0 M ${y(0)}-01-01 210`,
      `LNU04000000 Q ${y(0)}-01-01 4.1`,
    ]);

    // known series: one recent-window request; an unchanged response
    // (different responseTime) is not a new vintage
    requests.length = 0;
    const second = await runFetch("bls", { env });
    // (NOSUCH00000 never completed a walk, so it is walked again first)
    expect(requests).toEqual([
      `${y(19)}-${y(0)} NOSUCH00000`,
      `${y(19)}-${y(0)} CUUR0000SA0,LNU04000000`,
    ]);
    expect(second.status).toBe("unchanged");

    // a revision → new vintage of that series' key only; newest wins
    data.CUUR0000SA0[1].value = "201.5";
    const third = await runFetch("bls", { env });
    expect(third.status).toBe("ok");
    expect(db.artifacts).toHaveLength(4);
    const latest = readExtract(
      join(root, db.extractionRun(third.extractions[0].runId!).outputPath!),
    );
    expect(latest.rows.find((r) => r.date === `${y(1)}-01-01`)!.value).toBe(
      201.5,
    );
    // the older window's data survives (it came from its own artifact)
    expect(latest.rows.some((r) => r.date === `${y(25)}-01-01`)).toBe(true);
  });

  test("only: a load fetches just its own series", async () => {
    const { env, requests } = blsSetup(
      {
        CUUR0000SA0: [{ year: y(0), period: "M01", value: "1" }],
        CUURS35DSA0: [{ year: y(0), period: "M01", value: "2" }],
      },
      [{ series_id: "CUUR0000SA0" }],
    );
    const out = await runFetch("bls", {
      env,
      only: [{ series_id: "CUURS35DSA0", frequency: "M" }],
    });
    expect(out.status).toBe("ok");
    expect(requests).toEqual([
      `${y(19)}-${y(0)} CUURS35DSA0`,
      `${y(39)}-${y(20)} CUURS35DSA0`,
    ]);
  });

  test("a failed request fails those keys and the fetch", async () => {
    const { env, db } = blsSetup({}, [{ series_id: "CUUR0000SA0" }]);
    env.http = async () => new Response("boom", { status: 500 });
    const out = await runFetch("bls", { env });
    expect(out.status).toBe("failed");
    expect(out.extractions).toHaveLength(0);
    expect(db.artifacts).toHaveLength(0);
  });
});
