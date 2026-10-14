/**
 * dotax_current — "Current Monthly Tax Reports" on tax.hawaii.gov.
 *
 *   Series.load_from_dotax_current("collec", "General Excise & Use", "General Excise & Use", "State")
 *   Series.load_from_dotax_current("collec", "Income-Ind.", "Refunds", "State")
 *
 * Every XLSX listed on the page is a source Download. Files for months in
 * the live window (the current year, `liveYears` = 1) are refetched every
 * run, since DOTAX revises them in place (the previous copy is kept under
 * superseded/); once a file's month falls before the live window it is
 * marked historical after its next successful fetch and never refetched.
 * Every cached file — including ones that have dropped off the page — is
 * parsed into the output each time something changed.
 */

import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";

import { hstToInstant } from "@catalog/utils/time";

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
  currentCatalog,
  fetchPage,
  FILE_DELAY_MS,
  findLink,
  pickPerMonth,
  reportType,
  sleep,
  STATS_URL,
} from "./site";
import type { InventoryFile } from "./site";

export const dotaxCurrent: DownloaderImpl = {
  handle: "dotax_current",
  loadMethod: "load_from_dotax_current",
  loadSignature:
    'load_from_dotax_current("<type>", "<tax>", "<source>", "<area>")',
  outputHandle: "DOTAX_CURRENT@tax.hawaii.gov",
  supportsKeyedRuns: false,

  keyFromArgs: (args) => dotaxKeyFromArgs("load_from_dotax_current", args),
  layout: DOTAX_LAYOUT,
  indexKey: dotaxIndexKey,

  async run(ctx) {
    const liveYears = Number(ctx.downloader.configValue("liveYears", 1));
    const failOnProblems = ctx.downloader.configValue("failOnProblems", true);
    const firstLiveYear = new Date().getFullYear() - liveYears + 1;

    // CATALOG
    const statsPage = await fetchPage(STATS_URL);
    const currentUrl = findLink(
      statsPage,
      /^Current Monthly Tax Reports$/,
      "the stats page",
    );
    const items = currentCatalog(await fetchPage(currentUrl));
    if (items.length === 0)
      throw new Error(`no XLSX links found on ${currentUrl}`);
    ctx.log(`${items.length} files listed on ${currentUrl}`);

    // FETCH (historical files are skipped by sources.fetch)
    let fetched = 0;
    let changed = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const item of items) {
      const file = fileNameFromUrl(item.url);
      const ext = /\.xls$/i.test(file) ? "xls" : "xlsx";
      const dl = await ctx.sources.upsert({
        handle: sourceHandle("CUR", item.month, file),
        url: item.url,
        filenameExt: ext,
        notes: [item.title, item.revisedNote].filter(Boolean).join(" ") || null,
      });
      if (dl.historical && !ctx.full) {
        skipped++;
        continue;
      }
      await sleep(FILE_DELAY_MS);
      const res = await ctx.sources.fetch(dl);
      if (res.status === "error") {
        errors.push(`${file}: ${res.error}`);
        continue;
      }
      fetched++;
      if (res.changed) changed++;
      if (Number(item.month.slice(0, 4)) < firstLiveYear) {
        await ctx.sources.markHistorical(res.download);
      }
    }
    ctx.log(
      `fetched ${fetched} (${changed} changed), ${skipped} historical skipped, ${errors.length} errors`,
    );

    // INVENTORY: every cached source file, one per report type and month
    const files: InventoryFile[] = [];
    for (const dl of await ctx.sources.list()) {
      const meta = parseSourceHandle(dl.handle);
      const path = dl.savePath();
      if (!meta || !existsSync(path)) continue;
      const file = `${meta.stem}.${dl.filenameExt ?? "xlsx"}`;
      const type = reportType(file);
      if (!type) continue;
      const when = dl.lastChangeAt ?? dl.lastDownloadAt;
      files.push({
        type,
        month: meta.month,
        file,
        path,
        source: dl.handle!,
        fileDate: when ? hstToInstant(when).getTime() : 0,
      });
    }
    const picked = pickPerMonth(files);

    const fingerprint = createHash("sha1")
      .update(configFingerprint())
      .update(DOTAX_LAYOUT.columns.join(","))
      .update(
        picked
          // last_change_at (fileDate), not mtime: downloadToServer rewrites
          // unchanged files, so mtime moves on every fetch
          .map((f) => `${f.path}:${statSync(f.path).size}:${f.fileDate}`)
          .join("\n"),
      )
      .digest("hex");
    const baseStats = {
      listed: items.length,
      fetched,
      changed,
      historicalSkipped: skipped,
      fetchErrors: errors.slice(0, 20),
      filesCached: files.length,
      filesUsed: picked.length,
    };
    if (!ctx.force && ctx.downloader.state.parseFingerprint === fingerprint) {
      ctx.log("report files unchanged since the last parse — output kept");
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
      // fetch failures don't block the parse (cached copies are used);
      // they surface as last_error
      failedKeys: errors,
      stats,
    };
  },
};
