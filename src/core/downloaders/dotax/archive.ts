/**
 * dotax_archive — "Archived Full Monthly Reports By Year" on tax.hawaii.gov.
 *
 *   Series.load_from_dotax_archive("ge", "Base", "Retailing", "Maui")
 *
 * One zip per month; the spreadsheets are only available inside the zips.
 * A revised month gets a new zip name, so each zip is a source Download
 * that is fetched once and marked historical. Months the page does not
 * link (or links to the wrong zip) are tried under the zip name the
 * neighbouring months use. Zips are extracted under
 * DATA_DIR/downloaders/dotax_archive/archive/<zip>/. Archive months before
 * `firstMonth` (2002-01) are skipped: older files are Lotus .wk4.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize, sep } from "node:path";

import XLSX from "xlsx";

import type { DownloaderImpl } from "../types";
import { DOTAX_LAYOUT, dotaxIndexKey, dotaxKeyFromArgs } from "./args";
import { configFingerprint } from "./config";
import {
  buildReport,
  fileNameFromUrl,
  parseSourceHandle,
  problemLines,
  sourceHandle,
  writeProblems,
} from "./report";
import {
  archiveCatalog,
  fetchPage,
  FILE_DELAY_MS,
  findLink,
  monthRange,
  pickPerMonth,
  reportType,
  sleep,
  STATS_URL,
  urlExists,
} from "./site";
import type { ArchiveItem, InventoryFile } from "./site";

type ZipEntry = { name: string; path: string; date: number };

/**
 * Extract a zip (once per zip version) and list its non-empty entries.
 * Entry paths are confined to `dir` (no "..", no absolute paths).
 */
function extractZip(zipPath: string, dir: string): ZipEntry[] {
  const zipStat = statSync(zipPath);
  const marker = join(dir, ".extracted");
  const stamp = `${zipStat.size}:${zipStat.mtimeMs}`;
  const fresh = existsSync(marker) && readFileSync(marker, "utf8") === stamp;
  const z = XLSX.CFB.read(readFileSync(zipPath), { type: "buffer" });
  const out: ZipEntry[] = [];
  for (let i = 0; i < z.FileIndex.length; i++) {
    const e = z.FileIndex[i] as {
      type: number;
      size: number;
      mt?: Date;
      content?: Uint8Array;
    };
    const full: string = z.FullPaths[i];
    if (e.type !== 2 || !e.size || full.endsWith("/")) continue;
    const rel = full.replace(/^Root Entry\//, "");
    if (rel === "Sh33tJ5" || !rel) continue; // CFB's placeholder entry
    const safe = normalize(rel);
    if (safe.startsWith("..") || safe.startsWith(sep)) continue;
    const path = join(dir, safe);
    if (!fresh && e.content) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(e.content));
    }
    out.push({
      name: safe.split(sep).pop() ?? safe,
      path,
      date: e.mt ? e.mt.getTime() : zipStat.mtimeMs,
    });
  }
  if (!fresh) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, stamp);
  }
  return out;
}

export const dotaxArchive: DownloaderImpl = {
  handle: "dotax_archive",
  loadMethod: "load_from_dotax_archive",
  loadSignature:
    'load_from_dotax_archive("<type>", "<tax>", "<source>", "<area>")',
  outputHandle: "DOTAX_ARCHIVE@tax.hawaii.gov",
  supportsKeyedRuns: false,

  keyFromArgs: (args) => dotaxKeyFromArgs("load_from_dotax_archive", args),
  layout: DOTAX_LAYOUT,
  indexKey: dotaxIndexKey,

  async run(ctx) {
    const firstMonth = String(
      ctx.downloader.configValue("firstMonth", "2002-01"),
    );
    const failOnProblems = ctx.downloader.configValue("failOnProblems", true);

    // CATALOG: stats → Current Monthly Tax Reports → Archived Full Monthly Reports
    const statsPage = await fetchPage(STATS_URL);
    const currentUrl = findLink(
      statsPage,
      /^Current Monthly Tax Reports$/,
      "the stats page",
    );
    const archiveUrl = findLink(
      await fetchPage(currentUrl),
      /Archived Full Monthly Reports/,
      "Current Monthly Tax Reports",
    );
    const zips: ArchiveItem[] = archiveCatalog(
      await fetchPage(archiveUrl),
      firstMonth,
    );
    if (zips.length === 0)
      throw new Error(`no zip links found on ${archiveUrl}`);
    ctx.log(`${zips.length} zips listed on ${archiveUrl}`);

    // months the page does not link (or links to the wrong zip): try the
    // zip name the neighbouring months use, in the same directory
    const existing = await ctx.sources.list();
    const have = new Set([
      ...zips.map((z) => z.month),
      ...existing
        .map((d) => parseSourceHandle(d.handle)?.month)
        .filter(Boolean),
    ]);
    const lastMonth = zips
      .map((z) => z.month)
      .sort()
      .pop()!;
    const toMs = (mo: string) =>
      Date.UTC(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)) - 1);
    for (const g of monthRange(firstMonth, lastMonth).filter(
      (m) => !have.has(m),
    )) {
      const near = [...zips].sort(
        (a, b) =>
          Math.abs(toMs(a.month) - toMs(g)) - Math.abs(toMs(b.month) - toMs(g)),
      )[0];
      const guess = near.url.replace(/[^/]+$/, `${g}.zip`);
      if (await urlExists(guess)) {
        ctx.log(`${g} not linked on the archive page; using ${guess}`);
        zips.push({ url: guess, month: g });
      }
    }

    // FETCH new zips (historical ones are final)
    let fetched = 0;
    let skipped = 0;
    const unavailable: string[] = [];
    const errors: string[] = [];
    for (const z of zips) {
      const dl = await ctx.sources.upsert({
        handle: sourceHandle("ARC", z.month, fileNameFromUrl(z.url)),
        url: z.url,
        filenameExt: "zip",
      });
      if (dl.historical && !ctx.full) {
        skipped++;
        continue;
      }
      await sleep(FILE_DELAY_MS);
      const res = await ctx.sources.fetch(dl);
      if (res.status === "error") {
        // a listed href that 404s is a site error, not ours - skip it
        // (reported in the stats, not as a run error)
        unavailable.push(`${fileNameFromUrl(z.url)}: ${res.error}`);
        continue;
      }
      fetched++;
      await ctx.sources.markHistorical(res.download);
    }
    ctx.log(
      `fetched ${fetched} zips, ${skipped} already historical, ${unavailable.length} unavailable`,
    );

    // INVENTORY: every report file inside every cached zip
    const files: InventoryFile[] = [];
    for (const dl of await ctx.sources.list()) {
      const meta = parseSourceHandle(dl.handle);
      const zipPath = dl.savePath();
      if (!meta || !existsSync(zipPath)) continue;
      let entries: ZipEntry[];
      try {
        entries = extractZip(
          zipPath,
          join(ctx.cacheDir, "archive", `${meta.month}_${meta.stem}`),
        );
      } catch (e) {
        errors.push(
          `${dl.handle}: cannot unzip (${e instanceof Error ? e.message : e})`,
        );
        continue;
      }
      for (const e of entries) {
        const type = reportType(e.name);
        if (!type) continue;
        files.push({
          type,
          month: meta.month,
          file: e.name,
          path: e.path,
          source: dl.handle!,
          fileDate: e.date,
        });
      }
    }
    const picked = pickPerMonth(files);

    const fingerprint = createHash("sha1")
      .update(configFingerprint())
      .update(DOTAX_LAYOUT.columns.join(","))
      .update(
        picked.map((f) => `${f.path}:${statSync(f.path).size}`).join("\n"),
      )
      .update(
        existing
          .map((d) => `${d.handle}:${d.lastChangeAt?.getTime() ?? 0}`)
          .join("\n"),
      )
      .digest("hex");
    const baseStats = {
      listed: zips.length,
      fetched,
      historicalSkipped: skipped,
      unavailable: unavailable.slice(0, 20),
      unzipErrors: errors.slice(0, 20),
      filesCached: files.length,
      filesUsed: picked.length,
    };
    if (
      !ctx.force &&
      fetched === 0 &&
      ctx.downloader.state.parseFingerprint === fingerprint
    ) {
      ctx.log("no new zips since the last parse — output kept");
      return {
        write: null,
        failedKeys: errors,
        stats: { ...baseStats, parsed: false },
      };
    }

    // PARSE + CHECK
    const report = buildReport(picked, ctx.log);
    writeProblems(ctx.cacheDir, report.open, report.waived);
    const stats = {
      ...baseStats,
      parsed: true,
      months: report.months,
      outputRowsParsed: report.rows.length,
      problemsOpen: report.open.length,
      problemsWaived: report.waived.length,
      problems: problemLines(report.open, 50),
    };
    if (report.open.length > 0 && failOnProblems) {
      return {
        write: null,
        error: `${report.open.length} problem(s) in the DOTAX files, output not updated. First: ${problemLines(report.open, 3).join(" | ")}`,
        stats,
      };
    }
    ctx.setState({ parseFingerprint: fingerprint });
    return {
      write: { mode: "replace", rows: report.rows },
      failedKeys: errors,
      stats,
    };
  },
};
