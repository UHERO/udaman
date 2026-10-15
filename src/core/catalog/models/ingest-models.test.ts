import { beforeAll, describe, expect, test } from "bun:test";

import DataDownloader from "./data-downloader";
import DataExtractor from "./data-extractor";
import ExtractionRun from "./extraction-run";
import type { ExtractionRunAttrs } from "./extraction-run";
import FetchRun from "./fetch-run";
import RawArtifact from "./raw-artifact";

beforeAll(() => {
  process.env.DATA_DIR = "/data";
});

const run = (over: Partial<ExtractionRunAttrs>) =>
  new ExtractionRun({
    id: 1,
    extractor_id: 2,
    status: "failed",
    started_at: "2026-10-14 10:00:00",
    output_path: "ingest/extracts/dotax/1.csv",
    ...over,
  });

describe("DataDownloader", () => {
  test("parses JSON columns that arrive as strings", () => {
    const d = new DataDownloader({
      id: 1,
      handle: "dotax_current",
      source_key: "dotax",
      strategy: "custom",
      config: '{"liveYears": 1}',
      state: null,
      schedule: "  ",
      enabled: 0,
    });
    expect(d.config).toEqual({ liveYears: 1 });
    expect(d.state).toEqual({});
    expect(d.schedule).toBeNull();
    expect(d.enabled).toBe(false);
    expect(d.configValue("liveYears", 2)).toBe(1);
    expect(d.configValue("missing", 2)).toBe(2);
  });

  test("an unknown strategy falls back to custom", () => {
    const d = new DataDownloader({ id: 1, handle: "x1", strategy: "ftp" });
    expect(d.strategy).toBe("custom");
  });

  test("bad JSON and arrays are not config objects", () => {
    expect(
      new DataDownloader({ id: 1, handle: "x1", config: "{" }).config,
    ).toEqual({});
    expect(
      new DataDownloader({ id: 1, handle: "x1", config: "[1]" }).config,
    ).toEqual({});
  });
});

describe("DataExtractor", () => {
  test("defaults to enabled", () => {
    const e = new DataExtractor({
      id: 1,
      handle: "dotax",
      source_key: "dotax",
    });
    expect(e.enabled).toBe(true);
    expect(e.config).toEqual({});
  });
});

describe("RawArtifact", () => {
  const attrs = {
    id: 7,
    downloader_id: 1,
    artifact_key: "collec/2025-12",
    content_hash: "a".repeat(64),
    storage_path: "ingest/raw/dotax_current/aa/" + "a".repeat(64) + ".xlsx",
    size: "1234",
    final: 1,
    metadata: '{"title":"Dec 2025"}',
    fetched_at: "2026-10-14 10:00:00",
    last_seen_at: "2026-10-14 11:00:00",
  };

  test("coerces columns", () => {
    const a = new RawArtifact(attrs);
    expect(a.size).toBe(1234);
    expect(a.final).toBe(true);
    expect(a.metadata).toEqual({ title: "Dec 2025" });
    expect(a.absolutePath()).toBe(`/data/${attrs.storage_path}`);
  });

  test("a storage path may not escape DATA_DIR", () => {
    expect(() =>
      new RawArtifact({
        ...attrs,
        storage_path: "../etc/passwd",
      }).absolutePath(),
    ).toThrow(/escapes DATA_DIR/);
    expect(() =>
      new RawArtifact({ ...attrs, storage_path: "/etc/passwd" }).absolutePath(),
    ).toThrow(/escapes DATA_DIR/);
  });
});

describe("FetchRun", () => {
  test("an unknown status reads as failed", () => {
    const f = new FetchRun({
      id: 1,
      downloader_id: 1,
      status: "weird",
      started_at: "2026-10-14 10:00:00",
    });
    expect(f.status).toBe("failed");
  });
});

describe("ExtractionRun", () => {
  test("parses input ids and validation results", () => {
    const r = run({
      input_artifact_ids: "[3, 4]",
      validation_results:
        '[{"check":"columns","severity":"hard","passed":true,"message":"ok"}]',
    });
    expect(r.inputArtifactIds).toEqual([3, 4]);
    expect(r.validationResults).toHaveLength(1);
    expect(r.outputAbsolutePath()).toBe("/data/ingest/extracts/dotax/1.csv");
  });

  test("only soft failures can be accepted", () => {
    const soft = JSON.stringify([
      { check: "columns", severity: "hard", passed: true, message: "" },
      { check: "disappeared", severity: "soft", passed: false, message: "" },
    ]);
    const hard = JSON.stringify([
      { check: "duplicates", severity: "hard", passed: false, message: "" },
      { check: "disappeared", severity: "soft", passed: false, message: "" },
    ]);
    expect(run({ validation_results: soft }).canAccept()).toBe(true);
    expect(run({ validation_results: hard }).canAccept()).toBe(false);
    expect(run({ validation_results: hard }).failedChecks()[0].check).toBe(
      "duplicates",
    );
    // a parse exception: no results, no output
    expect(run({ output_path: null, error: "boom" }).canAccept()).toBe(false);
    // already ok
    expect(run({ status: "ok", validation_results: soft }).canAccept()).toBe(
      false,
    );
  });
});
