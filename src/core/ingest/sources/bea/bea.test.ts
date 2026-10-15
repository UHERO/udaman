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
import { periodFrequency } from "./fetch";
import { beaSource } from "./index";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ingest-bea-"));
  process.env.DATA_DIR = root;
  process.env.API_KEY_BEA ??= "test-key";
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Dp = Record<string, string>;

/**
 * A fake BEA GetData: `tables["Regional/CAINC5N"]` lists every row; the
 * response echoes the request (with the key) and a production time, like
 * BEA. An unknown table is BEA's HTTP-200 error.
 */
function fakeBea(tables: Record<string, Dp[]>, requests: string[]): HttpFetch {
  let tick = 0;
  return async (url) => {
    const q = new URL(url).searchParams;
    const ds = q.get("datasetname")!;
    const table = q.get("TableName")!;
    requests.push(
      `${ds} ${table} ${q.get("LineCode") ?? ""} ${q.get("GeoFips") ?? ""} ${q.get("Frequency") ?? ""}`.trim(),
    );
    const rows = tables[`${ds}/${table}`];
    const Request = {
      RequestParam: [
        { ParameterName: "USERID", ParameterValue: q.get("UserID") },
      ],
    };
    if (!rows) {
      return Response.json({
        BEAAPI: {
          Request,
          Results: {
            Error: table.startsWith("MA")
              ? { APIErrorCode: "40", APIErrorDescription: "Invalid TableName" }
              : { APIErrorCode: "1", APIErrorDescription: "server trouble" },
          },
        },
      });
    }
    return Response.json({
      BEAAPI: {
        Request,
        Results: {
          UTCProductionTime: `2026-10-15T00:00:0${tick++}`,
          Data: rows.filter(
            (r) => ds === "NIPA" || r.GeoFips === q.get("GeoFips"),
          ),
        },
      },
    });
  };
}

function setup(
  tables: Record<string, Dp[]>,
  filters: Array<Record<string, string>>,
) {
  const db = new MemoryDb();
  const requests: string[] = [];
  const dl = db.addDownloader({
    handle: "bea",
    source_key: "bea",
    strategy: "custom",
    config: {},
  });
  db.addExtractor({ handle: "bea", source_key: "bea", config: {} }, [
    { downloaderId: dl.id },
  ]);
  db.filters.set("bea", filters);
  const env: Partial<RunEnv> = {
    db,
    store: fileRawStore(root),
    http: fakeBea(tables, requests),
    sources: { bea: beaSource },
    sleep: async () => {},
  };
  return { db, env, requests };
}

const reg = (
  line: string,
  geo: string,
  tp: string,
  v: string,
  note = "",
): Dp => ({
  Code: `CAINC5N-${line}`,
  GeoFips: geo,
  GeoName: "Kauai",
  TimePeriod: tp,
  CL_UNIT: "Thousands of dollars",
  UNIT_MULT: "3",
  DataValue: v,
  NoteRef: note,
  Description: `line ${line}`,
});
const nipa = (line: string, tp: string, v: string): Dp => ({
  TableName: "T10105",
  SeriesCode: `S${line}`,
  LineNumber: line,
  LineDescription: `line ${line}`,
  TimePeriod: tp,
  CL_UNIT: "Level",
  UNIT_MULT: "6",
  DataValue: v,
  NoteRef: "T10105",
});

describe("bea source", () => {
  test("period frequencies", () => {
    expect(periodFrequency("2024")).toBe("A");
    expect(periodFrequency("2024Q3")).toBe("Q");
    expect(periodFrequency("2024M07")).toBe("M");
    expect(periodFrequency("2024M13")).toBeNull();
  });

  test("one request per table and geo, only the asked-for series stored", async () => {
    const tables = {
      "Regional/CAINC5N": [
        reg("201", "15007", "2021", "100"),
        reg("201", "15007", "2022", "(D)"),
        reg("201", "15007", "2023", "0", "(NA)"),
        reg("201", "15007", "2024", "1,300"),
        reg("202", "15007", "2024", "5"),
        reg("201", "15001", "2024", "7"),
      ],
      "NIPA/T10105": [
        nipa("1", "2024", "29,000.5"),
        nipa("1", "2024Q1", "7,000"),
        nipa("2", "2024", "1"),
      ],
    };
    const { db, env, requests } = setup(tables, [
      {
        dataset: "Regional",
        table: "CAINC5N",
        line: "201",
        geo: "15007",
        frequency: "A",
      },
      {
        dataset: "regional",
        table: "CAINC5N",
        line: "201",
        geo: "15001",
        frequency: "A",
      },
      {
        dataset: "Regional",
        table: "CAINC5N",
        line: "999",
        geo: "15007",
        frequency: "A",
      },
      { dataset: "NIPA", table: "T10105", line: "1", frequency: "Q" },
      { dataset: "NIPA", table: "T10105", line: "1", frequency: "A" },
      { dataset: "Regional", table: "CAINC5N", line: "201", frequency: "A" },
    ]);
    const first = await runFetch("bea", { env });
    expect(first.status).toBe("ok");
    expect(requests).toEqual([
      "NIPA T10105   A,Q,M",
      "Regional CAINC5N ALL 15001",
      "Regional CAINC5N ALL 15007",
    ]);
    expect(db.artifacts.map((a) => a.artifact_key).sort()).toEqual([
      "NIPA/T10105/1/-/A",
      "NIPA/T10105/1/-/Q",
      "Regional/CAINC5N/201/15001/A",
      "Regional/CAINC5N/201/15007/A",
    ]);
    const warnings = first.stats.warnings as string[];
    expect(warnings).toContain(
      "Regional/CAINC5N/999/15007/A: not in the response",
    );
    expect(warnings.some((w) => w.includes("no geo"))).toBe(true);
    // the key BEA echoes back is never stored
    for (const a of db.artifacts) {
      expect(readFileSync(join(root, a.storage_path), "utf8")).not.toContain(
        process.env.API_KEY_BEA!,
      );
    }

    const outPath = join(
      root,
      db.extractionRun(first.extractions[0].runId!).outputPath!,
    );
    const out = readExtract(outPath);
    expect(
      out.rows.map(
        (r) => `${Object.values(r.dims).join(" ")} ${r.date} ${r.value}`,
      ),
    ).toEqual([
      "NIPA T10105 1 - A 2024-01-01 29000.5",
      "NIPA T10105 1 - Q 2024-01-01 7000",
      "Regional CAINC5N 201 15001 A 2024-01-01 7",
      "Regional CAINC5N 201 15007 A 2021-01-01 100",
      "Regional CAINC5N 201 15007 A 2024-01-01 1300",
    ]);
    const missing = readFileSync(
      outPath.replace(/\.csv$/, ".missing.csv"),
      "utf8",
    );
    expect(missing).toContain("2022-01-01");
    expect(missing).toContain("(NA)");

    const second = await runFetch("bea", { env });
    expect(second.status).toBe("unchanged");
  });

  test("a rejected table (code 40) is a warning; the rest still extracts", async () => {
    const { env, db } = setup({ "NIPA/T10105": [nipa("1", "2024", "1")] }, [
      {
        dataset: "Regional",
        table: "MARPI",
        line: "1",
        geo: "27980",
        frequency: "A",
      },
      { dataset: "NIPA", table: "T10105", line: "1", frequency: "A" },
    ]);
    const out = await runFetch("bea", { env });
    expect(out.status).toBe("ok");
    expect(out.extractions[0].status).toBe("ok");
    expect(db.artifacts).toHaveLength(1);
    const warnings = out.stats.warnings as string[];
    expect(
      warnings.some((w) => w.startsWith("Regional/MARPI/27980: BEA API Error")),
    ).toBe(true);
  });

  test("BEA errors fail their keys; enough in a row stop the run", async () => {
    const filters = ["A", "B", "C", "D", "E", "F", "G"].map((t) => ({
      dataset: "NIPA",
      table: `T${t}`,
      line: "1",
      frequency: "A",
    }));
    const { env, requests } = setup({}, filters);
    const out = await runFetch("bea", { env });
    expect(out.status).toBe("failed");
    expect(requests).toHaveLength(5);
    expect(out.message).not.toContain(process.env.API_KEY_BEA!);
  });
});
