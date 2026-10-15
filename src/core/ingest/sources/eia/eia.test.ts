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
import { eiaSource } from "./index";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-eia-"));
  process.env.DATA_DIR = root;
  process.env.API_KEY_EIA ??= "test-key";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Row = Record<string, string | null>;

/** A fake EIA v2: `routes[route]` lists every row; facets narrow, pages of `pageSize`. */
function fakeEia(
  routes: Record<string, Row[]>,
  requests: string[],
  pageSize = 5000,
): HttpFetch {
  return async (url) => {
    const u = new URL(url);
    const route = u.pathname.replace(/^\/v2\/|\/data$/g, "");
    const q = u.searchParams;
    const ids = q.getAll("facets[seriesId][]");
    const scen = q.getAll("facets[scenario][]");
    const offset = Number(q.get("offset"));
    requests.push(
      `${route} ${q.get("frequency")} ${ids.join(",")} ${scen.join(",")} @${offset}`,
    );
    const all = (routes[route] ?? [])
      .filter(
        (r) =>
          ids.includes(r.seriesId!) &&
          (!scen.length || scen.includes(r.scenario!)),
      )
      .sort((a, b) => a.period!.localeCompare(b.period!));
    return Response.json({
      response: {
        total: String(all.length),
        data: all.slice(
          offset,
          offset + Math.min(pageSize, Number(q.get("length"))),
        ),
      },
      request: { command: `/v2/${route}/data/` },
      apiVersion: `2.1.${requests.length}`,
    });
  };
}

function setup(
  routes: Record<string, Row[]>,
  filters: Array<Record<string, string>>,
  pageSize?: number,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const dl = db.addDownloader({
    handle: "eia",
    source_key: "eia",
    strategy: "custom",
    config: {},
  });
  db.addExtractor({ handle: "eia", source_key: "eia", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("eia", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeEia(routes, requests, pageSize),
    sources: { eia: eiaSource },
    sleep: async () => {},
  };
  return { db, env, requests };
}

const steo = (id: string, period: string, value: string | null): Row => ({
  period,
  seriesId: id,
  seriesDescription: `${id} price`,
  value,
  unit: "$/bbl",
});
const aeo = (
  scenario: string,
  id: string,
  period: string,
  value: string,
): Row => ({
  period,
  scenario,
  seriesId: id,
  seriesName: id,
  value,
  unit: "nom $/bbl",
  history: "PROJECTION",
});

describe("eia source", () => {
  test("one request per route and frequency, one artifact per series; apiVersion doesn't make vintages", async () => {
    const routes = {
      steo: [
        steo("WTIPUUS", "2026-01", "70.1"),
        steo("WTIPUUS", "2026-02", null),
        steo("WTIPUUS", "2026-03", "71"),
        steo("BREPUUS", "2026-01", "74.5"),
      ],
      "aeo/2025": [
        aeo("ref2025", "wti", "2030", "80"),
        aeo("lowprice", "wti", "2030", "50"),
        aeo("ref2025", "brent", "2030", "85"),
      ],
    };
    const { db, env, requests } = setup(
      routes,
      [
        { route: "steo", series_id: "WTIPUUS", frequency: "M" },
        { route: "steo", series_id: "BREPUUS", frequency: "M" },
        {
          route: "aeo/2025",
          scenario: "ref2025",
          series_id: "wti",
          frequency: "A",
        },
        {
          route: "aeo/2025",
          scenario: "lowprice",
          series_id: "wti",
          frequency: "A",
        },
        {
          route: "aeo/2025",
          scenario: "ref2025",
          series_id: "brent",
          frequency: "A",
        },
        {
          route: "aeo/2025",
          scenario: "ref2025",
          series_id: "nosuch",
          frequency: "A",
        },
        { route: "steo", series_id: "WTIPUUS" },
      ],
      2,
    );
    const first = await runFetch("eia", { env });
    expect(first.status).toBe("ok");
    expect(requests).toEqual([
      "aeo/2025 annual brent,nosuch,wti lowprice,ref2025 @0",
      "aeo/2025 annual brent,nosuch,wti lowprice,ref2025 @2",
      "steo monthly BREPUUS,WTIPUUS  @0",
      "steo monthly BREPUUS,WTIPUUS  @2",
    ]);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "aeo/2025/lowprice/wti/A",
      "aeo/2025/ref2025/brent/A",
      "aeo/2025/ref2025/wti/A",
      "steo/-/BREPUUS/M",
      "steo/-/WTIPUUS/M",
    ]);
    const warnings = first.stats.warnings as string[];
    expect(
      warnings.some((w) =>
        w.startsWith("aeo/2025/ref2025/nosuch/A: not in the response"),
      ),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("no frequency"))).toBe(true);

    const out = readExtract(
      join(root, db.extractionRun(first.extractions[0].runId!).outputPath!),
    );
    expect(out.dims).toEqual(["route", "scenario", "series_id", "frequency"]);
    expect(
      out.rows.map(
        (r) => `${Object.values(r.dims).join(" ")} ${r.date} ${r.value}`,
      ),
    ).toEqual([
      "aeo/2025 lowprice wti A 2030-01-01 50",
      "aeo/2025 ref2025 brent A 2030-01-01 85",
      "aeo/2025 ref2025 wti A 2030-01-01 80",
      "steo - BREPUUS M 2026-01-01 74.5",
      "steo - WTIPUUS M 2026-01-01 70.1",
      "steo - WTIPUUS M 2026-03-01 71",
    ]);

    const second = await runFetch("eia", { env });
    expect(second.status).toBe("unchanged");
  });

  test("an HTTP error fails that group and the fetch", async () => {
    const { env, db } = setup({}, [
      { route: "steo", series_id: "X", frequency: "M" },
    ]);
    env.http = async () => new Response('{"error":"bad"}', { status: 400 });
    const out = await runFetch("eia", { env });
    expect(out.status).toBe("failed");
    expect(db.artifacts).toHaveLength(0);
  });
});
