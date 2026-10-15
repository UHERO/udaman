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
import { narrowing } from "./fetch";
import { estatjpSource } from "./index";
import { estatMonth } from "./parse";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-estatjp-"));
  process.env.DATA_DIR = root;
  process.env.API_KEY_ESTATJP ??= "test-key";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Cell = Record<string, string>;

/**
 * A fake getStatsData: `tables[id]` lists every cell; cd filters (comma
 * lists) narrow them, and `pageSize` splits the answer with NEXT_KEY.
 * Every response carries a fresh RESULT.DATE, like e-Stat.
 */
function fakeEstat(
  tables: Record<string, { classes: string[]; cells: Cell[] }>,
  requests: string[],
  pageSize = 1000,
): HttpFetch {
  let tick = 0;
  return async (url) => {
    const q = new URL(url).searchParams;
    const id = q.get("statsDataId")!;
    const t = tables[id];
    const cd = [...q].filter(([k]) => k.startsWith("cd"));
    requests.push(`${id} ${cd.map(([k, v]) => `${k}=${v}`).join("&")}`);
    const result = {
      STATUS: 0,
      ERROR_MSG: "ok",
      DATE: `2026-10-15T09:00:0${tick++}`,
    };
    if (!t) {
      return Response.json({
        GET_STATS_DATA: {
          RESULT: { ...result, STATUS: 100, ERROR_MSG: "no table" },
        },
      });
    }
    const cells = t.cells.filter((c) =>
      cd.every(([k, v]) => {
        const id = k.slice(2).toLowerCase();
        return v.split(",").includes(c[`@${id}`]);
      }),
    );
    if (cells.length === 0) {
      return Response.json({
        GET_STATS_DATA: { RESULT: { ...result, STATUS: 1 } },
      });
    }
    const start = Number(q.get("startPosition") ?? 1);
    const page = cells.slice(start - 1, start - 1 + pageSize);
    const next =
      start - 1 + pageSize < cells.length ? start + pageSize : undefined;
    const classObj = [...t.classes, "time"].map((c) => {
      const codes = [...new Set(t.cells.map((x) => x[`@${c}`]))];
      const cls = codes.map((code) => ({
        "@code": code,
        "@name": `${c} ${code}`,
      }));
      return {
        "@id": c,
        "@name": c.toUpperCase(),
        CLASS: cls.length === 1 ? cls[0] : cls,
      };
    });
    return Response.json({
      GET_STATS_DATA: {
        RESULT: result,
        STATISTICAL_DATA: {
          RESULT_INF: { TOTAL_NUMBER: cells.length, NEXT_KEY: next },
          TABLE_INF: {
            "@id": id,
            TITLE: { $: "A table" },
            UPDATED_DATE: "2026-10-02",
          },
          CLASS_INF: { CLASS_OBJ: classObj },
          DATA_INF: {
            NOTE: { "@char": "***", $: "Not available." },
            VALUE: page,
          },
        },
      },
    });
  };
}

function setup(
  tables: Record<string, { classes: string[]; cells: Cell[] }>,
  filters: Array<Record<string, string>>,
  pageSize?: number,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const dl = db.addDownloader({
    handle: "estatjp",
    source_key: "estatjp",
    strategy: "custom",
    config: {},
  });
  db.addExtractor({ handle: "estatjp", source_key: "estatjp", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("estatjp", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeEstat(tables, requests, pageSize),
    sources: { estatjp: estatjpSource },
    sleep: async () => {},
  };
  return { db, env, requests };
}

const lfs = (cat02: string, time: string, value: string): Cell => ({
  "@tab": "01",
  "@cat01": "000",
  "@cat02": cat02,
  "@cat03": "0",
  "@area": "00000",
  "@time": time,
  "@unit": "ten thousand persons",
  $: value,
});

describe("estatjp source", () => {
  test("time codes", () => {
    expect(estatMonth("2024000101")).toBe("2024-01-01");
    expect(estatMonth("2026000808")).toBe("2026-08-01");
    expect(estatMonth("2024000000")).toBeNull(); // calendar year
    expect(estatMonth("2024100000")).toBeNull(); // fiscal year
    expect(estatMonth("2026000709")).toBeNull(); // Jul–Sep quarter
  });

  test("narrowing unions codes and leaves open what a statement leaves open", () => {
    expect(
      narrowing([
        { tab: "01", cat02: "08", area: "00000" },
        { tab: "01", cat02: "01" },
      ]),
    ).toEqual({ cat02: "01,08", tab: "01" });
  });

  test("one request per table, one artifact per series, paged; fetch stamps don't make vintages", async () => {
    const tables = {
      "0003005798": {
        classes: ["tab", "cat01", "cat02", "cat03", "area"],
        cells: [
          lfs("01", "2011000202", "6000"),
          lfs("01", "2011000303", "…"),
          lfs("01", "2011000404", "6100"),
          lfs("01", "2011000000", "6050"),
          lfs("08", "2011000202", "1,234"),
          lfs("09", "2011000202", "1"),
        ],
      },
      "0003427113": {
        classes: ["tab", "cat01", "area"],
        cells: [
          {
            "@tab": "1",
            "@cat01": "0001",
            "@area": "00000",
            "@time": "2026000808",
            $: "114.3",
          },
          {
            "@tab": "1",
            "@cat01": "0001",
            "@area": "00000",
            "@time": "2026000707",
            $: "114.2",
          },
        ],
      },
    };
    const { db, env, requests } = setup(
      tables,
      [
        {
          stats_data_id: "0003005798",
          tab: "01",
          cat01: "000",
          cat02: "01",
          cat03: "0",
          area: "00000",
          frequency: "M",
        },
        {
          stats_data_id: "0003005798",
          tab: "01",
          cat01: "000",
          cat02: "08",
          cat03: "0",
          area: "00000",
        },
        { stats_data_id: "0003427113", tab: "1", cat01: "0001", area: "00000" },
        { stats_data_id: "0003427113", tab: "1", cat01: "9999", area: "00000" },
        { stats_data_id: "nope" },
      ],
      2,
    );
    const first = await runFetch("estatjp", { env });
    expect(first.status).toBe("ok");
    expect(requests).toEqual([
      "0003005798 cdArea=00000&cdCat01=000&cdCat02=01,08&cdCat03=0&cdTab=01",
      "0003005798 cdArea=00000&cdCat01=000&cdCat02=01,08&cdCat03=0&cdTab=01",
      "0003005798 cdArea=00000&cdCat01=000&cdCat02=01,08&cdCat03=0&cdTab=01",
      "0003427113 cdArea=00000&cdCat01=0001,9999&cdTab=1",
    ]);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "0003005798/tab=01,cat01=000,cat02=01,cat03=0,area=00000",
      "0003005798/tab=01,cat01=000,cat02=08,cat03=0,area=00000",
      "0003427113/tab=1,cat01=0001,area=00000",
    ]);
    const warnings = first.stats.warnings as string[];
    expect(warnings.some((w) => w.includes('"nope" is not'))).toBe(true);
    expect(
      warnings.some(
        (w) => w.includes('"9999"') && w.includes("no such series"),
      ),
    ).toBe(true);

    const ex = first.extractions[0];
    expect(ex.status).toBe("ok");
    const outPath = join(root, db.extractionRun(ex.runId!).outputPath!);
    const out = readExtract(outPath);
    expect(out.dims).toEqual([
      "stats_data_id",
      "tab",
      "cat01",
      "cat02",
      "cat03",
      "area",
    ]);
    expect(
      out.rows.map(
        (r) => `${Object.values(r.dims).join(" ")} ${r.date} ${r.value}`,
      ),
    ).toEqual([
      "0003005798 01 000 01 0 00000 2011-02-01 6000",
      "0003005798 01 000 01 0 00000 2011-04-01 6100",
      "0003005798 01 000 08 0 00000 2011-02-01 1234",
      "0003427113 1 0001 - - 00000 2026-07-01 114.2",
      "0003427113 1 0001 - - 00000 2026-08-01 114.3",
    ]);
    const missing = readFileSync(
      outPath.replace(/\.csv$/, ".missing.csv"),
      "utf8",
    );
    expect(missing).toContain("2011-03-01");

    const second = await runFetch("estatjp", { env });
    expect(second.status).toBe("unchanged");
  });

  test("an API error fails that table and the fetch", async () => {
    const { env, db } = setup({}, [{ stats_data_id: "0000000001", tab: "1" }]);
    const out = await runFetch("estatjp", { env });
    expect(out.status).toBe("failed");
    expect(db.artifacts).toHaveLength(0);
  });
});
