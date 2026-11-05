import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WdsPoint } from "@catalog/utils/api-clients/statcan";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { readExtract } from "../../extract-file";
import type { HttpFetch } from "../../http";
import { fileRawStore } from "../../raw-store";
import { runFetch } from "../../run";
import type { RunEnv } from "../../run";
import { MemoryDb } from "../../testing/memory-db";
import { statcanSource } from "./index";
import { statcanFrequency } from "./parse";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-statcan-"));
  process.env.DATA_DIR = root;
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const pt = (
  refPer: string,
  value: number | null,
  releaseTime: string,
  extra: Partial<WdsPoint> = {},
): WdsPoint => ({
  refPer,
  refPer2: "",
  refPerRaw: refPer,
  refPerRaw2: "",
  value,
  decimals: 1,
  scalarFactorCode: 3,
  symbolCode: 0,
  statusCode: 0,
  securityLevelCode: 0,
  releaseTime,
  frequencyCode: 6,
  ...extra,
});

type Vec = { productId: number; coordinate: string; points: WdsPoint[] };

/**
 * A fake WDS: `data[vectorId]` is the vector; unknown ids get WDS's
 * FAILED object. Answers come back in reverse order, like WDS (not in
 * request order).
 */
function fakeWds(data: Record<number, Vec>, requests: string[]): HttpFetch {
  return async (url, init) => {
    const method = new URL(url).pathname.split("/").pop()!;
    const body = JSON.parse(String(init?.body ?? "null"));
    const answer = (id: number, f: (v: Vec) => Record<string, unknown>) => {
      const v = data[id];
      return v
        ? {
            status: "SUCCESS",
            object: {
              responseStatusCode: 0,
              productId: v.productId,
              coordinate: v.coordinate,
              vectorId: id,
              ...f(v),
            },
          }
        : {
            status: "FAILED",
            object: {
              responseStatusCode: 3,
              productId: 0,
              coordinate: ".........",
              vectorId: id,
              vectorDataPoint: [],
            },
          };
    };
    let out: unknown[];
    if (method === "getSeriesInfoFromVector") {
      const ids = (body as Array<{ vectorId: number }>).map((b) => b.vectorId);
      requests.push(`info ${ids.join(",")}`);
      out = ids.map((id) =>
        answer(id, () => ({
          frequencyCode: 6,
          scalarFactorCode: 3,
          decimals: 1,
          terminated: 0,
          SeriesTitleEn: `Series ${id}`,
          memberUomCode: 249,
        })),
      );
    } else if (method === "getDataFromVectorsAndLatestNPeriods") {
      const ids = (body as Array<{ vectorId: number }>).map((b) => b.vectorId);
      requests.push(`full ${ids.join(",")}`);
      out = ids.map((id) => answer(id, (v) => ({ vectorDataPoint: v.points })));
    } else if (method === "getBulkVectorDataByRange") {
      const b = body as {
        vectorIds: string[];
        startDataPointReleaseDate: string;
        endDataPointReleaseDate: string;
      };
      requests.push(`updates ${b.vectorIds.join(",")}`);
      out = b.vectorIds.map(Number).map((id) =>
        answer(id, (v) => ({
          vectorDataPoint: v.points.filter(
            (p) =>
              p.releaseTime >= b.startDataPointReleaseDate &&
              p.releaseTime <= b.endDataPointReleaseDate,
          ),
        })),
      );
    } else {
      return new Response("no such method", { status: 404 });
    }
    return new Response(JSON.stringify(out.reverse()));
  };
}

const today = new Date().toISOString().slice(0, 10);
const recent = `${today}T08:30`;

function setup(
  data: Record<number, Vec>,
  filters: Array<Record<string, string>>,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const dl = db.addDownloader({
    handle: "statcan",
    source_key: "statcan",
    strategy: "custom",
    config: {},
  });
  db.addExtractor({ handle: "statcan", source_key: "statcan", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("statcan", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeWds(data, requests),
    sources: { statcan: statcanSource },
    sleep: async () => {},
  };
  return { db, dl, env, requests };
}

function extractRows(db: MemoryDb, runId: number) {
  const outPath = join(root, db.extractionRun(runId).outputPath!);
  const out = readExtract(outPath);
  return {
    dims: out.dims,
    rows: out.rows.map(
      (r) => `${r.dims.series_id} ${r.dims.frequency} ${r.date} ${r.value}`,
    ),
    missing: existsSync(outPath.replace(/\.csv$/, ".missing.csv"))
      ? readFileSync(outPath.replace(/\.csv$/, ".missing.csv"), "utf8")
      : "",
  };
}

describe("statcan source", () => {
  test("full history once, then the releases since; revisions win by release time", async () => {
    const data: Record<number, Vec> = {
      2062810: {
        productId: 14100287,
        coordinate: "1.2.1.1.1.1.0.0.0.0",
        points: [
          pt("2007-01-01", 17000.1, "2008-01-10T07:00"),
          pt("2007-02-01", null, "2008-02-10T07:00", { statusCode: 1 }),
          pt("2007-03-01", 17002.3, "2008-03-10T07:00"),
          pt("2026-09-01", 22000.5, recent),
        ],
      },
      // population: quarterly point estimates tagged "occasional daily"
      1: {
        productId: 17100009,
        coordinate: "1.0.0.0.0.0.0.0.0.0",
        points: [
          pt("2026-01-01", 41716698, "2026-09-23T08:30", {
            frequencyCode: 21,
            scalarFactorCode: 0,
          }),
          pt("2026-04-01", 41718064, "2026-09-23T08:30", {
            frequencyCode: 21,
            scalarFactorCode: 0,
          }),
        ],
      },
    };
    const { db, env, requests } = setup(data, [
      { series_id: "v2062810", frequency: "M" },
      { series_id: "v1", frequency: "Q" },
      { series_id: "v999999999", frequency: "M" },
      { series_id: "2062810" },
    ]);

    const first = await runFetch("statcan", { env });
    expect(first.status).toBe("ok");
    expect(requests).toEqual([
      "info 1,2062810,999999999",
      "full 1,2062810,999999999",
      "updates 1,2062810",
    ]);
    const warnings = first.stats.warnings as string[];
    expect(warnings.some((w) => w.startsWith('"2062810" is not'))).toBe(true);
    expect(
      warnings.some((w) =>
        w.startsWith("v999999999: StatCan has no such vector"),
      ),
    ).toBe(true);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "v1/full",
      "v1/updates",
      "v2062810/full",
      "v2062810/updates",
    ]);

    const ex = extractRows(db, first.extractions[0].runId!);
    expect(ex.dims).toEqual(["series_id", "frequency"]);
    expect(ex.rows).toEqual([
      "v1 Q 2026-01-01 41716698",
      "v1 Q 2026-04-01 41718064",
      "v2062810 M 2007-01-01 17000.1",
      "v2062810 M 2007-03-01 17002.3",
      "v2062810 M 2026-09-01 22000.5",
    ]);
    expect(ex.missing).toContain("2007-02-01");

    // a later run: no full pull of the known vectors (the unknown one is
    // asked again, like FRED's 400s); nothing released → unchanged
    requests.length = 0;
    const second = await runFetch("statcan", { env });
    expect(second.status).toBe("unchanged");
    expect(requests).toEqual([
      "info 999999999",
      "full 999999999",
      "updates 1,2062810",
    ]);

    // a revision far back in the series, released today
    data[2062810].points[0] = pt("2007-01-01", 17111.1, `${today}T09:00`);
    const third = await runFetch("statcan", { env });
    expect(third.status).toBe("ok");
    const ex3 = extractRows(db, third.extractions[0].runId!);
    expect(ex3.rows).toContain("v2062810 M 2007-01-01 17111.1");
    expect(ex3.rows).not.toContain("v2062810 M 2007-01-01 17000.1");
  });

  test("a full refresh after fullRefreshDays drops points StatCan deleted", async () => {
    const data: Record<number, Vec> = {
      2062815: {
        productId: 14100287,
        coordinate: "1.7.1.1.1.1.0.0.0.0",
        points: [
          pt("2026-08-01", 6.6, "2026-09-05T08:30", { scalarFactorCode: 0 }),
          pt("2026-09-01", 6.5, recent, { scalarFactorCode: 0 }),
        ],
      },
    };
    const { db, dl, env, requests } = setup(data, [
      { series_id: "v2062815", frequency: "M" },
    ]);
    await runFetch("statcan", { env });
    expect(
      (db.downloaders.get(dl.id)!.state as { history?: unknown }).history,
    ).toEqual({
      v2062815: { fullAt: today },
    });

    data[2062815].points.shift();
    db.setDownloaderState(dl.id, {
      history: { v2062815: { fullAt: "2026-01-01" } },
    });
    requests.length = 0;
    const out = await runFetch("statcan", { env });
    expect(requests).toEqual([
      "info 2062815",
      "full 2062815",
      "updates 2062815",
    ]);
    expect(out.status).toBe("ok");
    expect(extractRows(db, out.extractions[0].runId!).rows).toEqual([
      "v2062815 M 2026-09-01 6.5",
    ]);
  });

  test("a WDS error body or a server error fails the fetch", async () => {
    const { env, db } = setup({}, [{ series_id: "v1", frequency: "Q" }]);
    env.http = async () =>
      new Response(JSON.stringify({ message: "JSON syntax error" }));
    const out = await runFetch("statcan", { env });
    expect(out.status).toBe("failed");
    expect(db.artifacts).toHaveLength(0);

    env.http = async () => new Response("boom", { status: 500 });
    expect((await runFetch("statcan", { env })).status).toBe("failed");
  });

  test("frequency from the code, or from the dates when the code is irregular", () => {
    const at = (refPer: string, frequencyCode: number) =>
      pt(refPer, 1, "2026-01-01T08:30", { frequencyCode });
    expect(statcanFrequency([at("2026-01-01", 9)])).toBe("Q");
    expect(statcanFrequency([at("2025-07-01", 21), at("2025-10-01", 21)])).toBe(
      "Q",
    );
    expect(statcanFrequency([at("2024-01-01", 18), at("2025-01-01", 18)])).toBe(
      "A",
    );
    expect(statcanFrequency([at("2025-02-01", 20), at("2025-03-01", 20)])).toBe(
      "M",
    );
    expect(statcanFrequency([at("2025-02-14", 21)])).toBeNull();
  });
});
