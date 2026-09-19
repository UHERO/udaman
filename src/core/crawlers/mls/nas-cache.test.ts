import { mkdir, mkdtemp, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  detailPath,
  iterateCachedDetails,
  latestDetailPath,
  listPagePath,
  mlsCacheRoot,
  readHtml,
  writeHtml,
} from "./nas-cache";

let root: string;
let savedEnv: string | undefined;

beforeEach(async () => {
  savedEnv = process.env.MLS_NAS_PATH;
  root = await mkdtemp(path.join(tmpdir(), "mls-cache-test-"));
  process.env.MLS_NAS_PATH = root;
});

afterEach(async () => {
  if (savedEnv === undefined) delete process.env.MLS_NAS_PATH;
  else process.env.MLS_NAS_PATH = savedEnv;
  await rm(root, { recursive: true, force: true });
});

describe("cache root", () => {
  test("MLS_NAS_PATH overrides the NAS autodetect", () => {
    expect(mlsCacheRoot()).toBe(root);
  });

  test("falls back to <scrapes root>/mls", () => {
    delete process.env.MLS_NAS_PATH;
    const fallback = mlsCacheRoot();
    expect(path.basename(fallback)).toBe("mls");
    expect(path.basename(path.dirname(fallback))).toBe("scrapes");
  });
});

describe("path builders", () => {
  test("list page path", () => {
    expect(
      listPagePath("hicentral", "2026-09-18", {
        island: "oahu",
        statusSet: "active",
        page: 7,
      }),
    ).toBe(path.join(root, "hicentral/list/2026-09-18/oahu/active/p0007.html"));
  });

  test("list page number is zero-padded to four digits", () => {
    const p = (page: number) =>
      path.basename(
        listPagePath("hicentral", "2026-09-18", {
          island: "maui",
          statusSet: "any",
          page,
        }),
      );
    expect(p(1)).toBe("p0001.html");
    expect(p(499)).toBe("p0499.html");
  });

  test("detail path shards on the first six characters", () => {
    expect(detailPath("hicentral", "202426768", "2026-09-18")).toBe(
      path.join(root, "hicentral/detail/202426/202426768/2026-09-18.html"),
    );
  });

  test("rejects malformed dates, pages and traversal attempts", () => {
    const q = { island: "oahu", statusSet: "any", page: 1 } as const;
    expect(() => listPagePath("hicentral", "2026-9-18", q)).toThrow();
    expect(() => listPagePath("hicentral", "today", q)).toThrow();
    expect(() =>
      listPagePath("hicentral", "2026-09-18", { ...q, page: 0 }),
    ).toThrow();
    expect(() => listPagePath("../etc", "2026-09-18", q)).toThrow();
    expect(() => detailPath("hicentral", "../../x", "2026-09-18")).toThrow();
    expect(() => detailPath("hicentral", "", "2026-09-18")).toThrow();
    expect(() =>
      detailPath("hicentral", "202426768", "2026-09-18.html"),
    ).toThrow();
  });
});

describe("read / write", () => {
  test("readHtml returns null for a missing file", async () => {
    expect(await readHtml(path.join(root, "nope/missing.html"))).toBeNull();
  });

  test("writeHtml creates parent directories and round-trips the whole file", async () => {
    const file = detailPath("hicentral", "202426768", "2026-09-18");
    const html = `<html>${"ʻokina — ".repeat(8_000)}</html>`; // ~90KB, multi-byte
    await writeHtml(file, html);
    expect(await readHtml(file)).toBe(html);
  });

  test("writeHtml leaves no temp file behind and overwrites in place", async () => {
    const file = detailPath("hicentral", "202426768", "2026-09-18");
    await writeHtml(file, "first");
    await writeHtml(file, "second");
    expect(await readHtml(file)).toBe("second");
    expect(await readdir(path.dirname(file))).toEqual(["2026-09-18.html"]);
  });

  test("a failed write leaves neither a truncated target nor a temp file", async () => {
    // The target path is an existing directory, so the final rename fails.
    const file = detailPath("hicentral", "202426768", "2026-09-18");
    await mkdir(file, { recursive: true });
    await writeFile(path.join(file, "keep"), "x");
    await expect(writeHtml(file, "<html></html>")).rejects.toThrow();
    expect(await readdir(path.dirname(file))).toEqual(["2026-09-18.html"]);
  });
});

describe("latest snapshot", () => {
  test("null when the listing has never been cached", async () => {
    expect(await latestDetailPath("hicentral", "202426768")).toBeNull();
  });

  test("picks the lexicographically greatest date, ignoring strays", async () => {
    // Written out of order on purpose.
    for (const d of ["2026-09-02", "2026-10-01", "2025-12-31", "2026-09-18"]) {
      await writeHtml(detailPath("hicentral", "202426768", d), d);
    }
    const dir = path.dirname(
      detailPath("hicentral", "202426768", "2026-09-18"),
    );
    await writeFile(
      path.join(dir, ".2027-01-01.html.123.tmp"),
      "crashed write",
    );
    await writeFile(path.join(dir, "notes.html"), "not a snapshot");
    await writeFile(path.join(dir, "2027-01-01.html.bak"), "not a snapshot");

    const latest = await latestDetailPath("hicentral", "202426768");
    expect(latest).toBe(detailPath("hicentral", "202426768", "2026-10-01"));
    expect(await readHtml(latest!)).toBe("2026-10-01");
  });
});

describe("iterateCachedDetails", () => {
  test("yields nothing for a site with no cache", async () => {
    const seen = [];
    for await (const e of iterateCachedDetails("hicentral")) seen.push(e);
    expect(seen).toEqual([]);
  });

  test("yields the latest snapshot per listing, across shards, one site only", async () => {
    await writeHtml(detailPath("hicentral", "202426768", "2026-09-01"), "old");
    await writeHtml(detailPath("hicentral", "202426768", "2026-09-18"), "new");
    await writeHtml(detailPath("hicentral", "202426001", "2026-09-10"), "only");
    await writeHtml(detailPath("hicentral", "202615118", "2026-09-17"), "a");
    await writeHtml(detailPath("hicentral", "202615118", "2026-09-18"), "b");
    await writeHtml(detailPath("othersite", "202400001", "2026-09-18"), "x");
    // A listing dir with no snapshot in it (crash between mkdir and rename).
    await mkdir(path.join(root, "hicentral/detail/202426/202426999"), {
      recursive: true,
    });
    // List pages must not leak into the detail walk.
    await writeHtml(
      listPagePath("hicentral", "2026-09-18", {
        island: "oahu",
        statusSet: "any",
        page: 1,
      }),
      "list",
    );

    const seen = [];
    for await (const e of iterateCachedDetails("hicentral")) seen.push(e);

    expect(seen).toEqual([
      {
        mlsNumber: "202426001",
        path: detailPath("hicentral", "202426001", "2026-09-10"),
      },
      {
        mlsNumber: "202426768",
        path: detailPath("hicentral", "202426768", "2026-09-18"),
      },
      {
        mlsNumber: "202615118",
        path: detailPath("hicentral", "202615118", "2026-09-18"),
      },
    ]);
  });
});
