/**
 * Acquire the tax.hawaii.gov monthly report files. Navigation only: the
 * report pages are read to find file links; every file is stored as is.
 *
 * Downloader config:
 *   { kind: "current", liveYears?: 1 }
 *     "Current Monthly Tax Reports": one XLSX per report per month. Files
 *     for months before the live window (this year, liveYears = 1) are
 *     final after their next fetch; DOTAX revises live ones in place, so
 *     they are refetched every run (a revision is a new vintage).
 *   { kind: "archive", firstMonth?: "2002-01" }
 *     "Archived Full Monthly Reports By Year": one zip per month, final on
 *     its first fetch (a revised month gets a new zip name). Months the
 *     page does not link are tried under the zip name the neighbouring
 *     months use. Older zips hold Lotus .wk4 files, hence firstMonth.
 *
 * Artifact keys are `<YYYY-MM>/<file name>`. Politeness: tax.hawaii.gov
 * has Crawl-delay 10 for pages; files are spaced 1 s apart.
 */

import { HttpError } from "../../http";
import type { FetchContext } from "../../types";
import { dotaxKey, parseDotaxKey } from "./artifact-keys";
import { monthRange } from "./dates";
import {
  archiveCatalog,
  currentCatalog,
  FILE_DELAY_MS,
  findLink,
  PAGE_DELAY_MS,
  STATS_URL,
} from "./fetch-site";
import type { ArchiveItem } from "./fetch-site";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function fileNameFromUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
}

async function currentPageUrl(ctx: FetchContext): Promise<string> {
  const stats = await ctx.getPage(STATS_URL);
  return findLink(stats, /^Current Monthly Tax Reports$/, "the stats page");
}

export async function fetchCurrent(ctx: FetchContext): Promise<void> {
  const liveYears = Number(ctx.downloader.config.liveYears ?? 1);
  const firstLiveYear = new Date().getFullYear() - liveYears + 1;

  const currentUrl = await currentPageUrl(ctx);
  await ctx.sleep(PAGE_DELAY_MS);
  const items = currentCatalog(await ctx.getPage(currentUrl));
  if (items.length === 0)
    throw new Error(`no XLSX links found on ${currentUrl}`);
  ctx.log(`${items.length} files listed on ${currentUrl}`);

  const finals = ctx.full ? new Set<string>() : await ctx.finalKeys();
  let skipped = 0;
  for (const item of items) {
    const file = fileNameFromUrl(item.url);
    const key = dotaxKey(item.month, file);
    if (finals.has(key)) {
      skipped++;
      continue;
    }
    await ctx.sleep(FILE_DELAY_MS);
    try {
      await ctx.download(item.url, key, {
        originalName: file,
        metadata: {
          month: item.month,
          title: item.title,
          ...(item.revisedNote ? { revisedNote: item.revisedNote } : {}),
        },
        final: Number(item.month.slice(0, 4)) < firstLiveYear,
      });
    } catch (e) {
      ctx.keyFailed(key, errMsg(e));
    }
  }
  ctx.log(`${skipped} final file(s) skipped`);
}

export async function fetchArchive(ctx: FetchContext): Promise<void> {
  const firstMonth = String(ctx.downloader.config.firstMonth ?? "2002-01");

  const currentUrl = await currentPageUrl(ctx);
  await ctx.sleep(PAGE_DELAY_MS);
  const archiveUrl = findLink(
    await ctx.getPage(currentUrl),
    /Archived Full Monthly Reports/,
    "Current Monthly Tax Reports",
  );
  await ctx.sleep(PAGE_DELAY_MS);
  const zips: ArchiveItem[] = archiveCatalog(
    await ctx.getPage(archiveUrl),
    firstMonth,
  );
  if (zips.length === 0) throw new Error(`no zip links found on ${archiveUrl}`);
  ctx.log(`${zips.length} zips listed on ${archiveUrl}`);

  const finals = ctx.full ? new Set<string>() : await ctx.finalKeys();
  const storedMonths = new Set(
    [...finals].map((k) => parseDotaxKey(k)?.month).filter(Boolean),
  );

  // months the page does not link (or links to the wrong zip): try the zip
  // name the neighbouring months use, in the same directory
  const have = new Set([...zips.map((z) => z.month), ...storedMonths]);
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
    await ctx.sleep(FILE_DELAY_MS);
    try {
      await ctx.get(guess, { method: "HEAD" });
      ctx.log(`${g} not linked on the archive page; using ${guess}`);
      zips.push({ url: guess, month: g });
    } catch {
      // not there either
    }
  }

  let skipped = 0;
  for (const z of zips) {
    const file = fileNameFromUrl(z.url);
    const key = dotaxKey(z.month, file);
    if (finals.has(key)) {
      skipped++;
      continue;
    }
    await ctx.sleep(FILE_DELAY_MS);
    try {
      await ctx.download(z.url, key, {
        originalName: file,
        metadata: { month: z.month },
        final: true,
      });
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) {
        // a listed href that 404s is the site's error, not a fetch failure
        ctx.warn(`${key}: listed but not available (404)`);
      } else {
        ctx.keyFailed(key, errMsg(e));
      }
    }
  }
  ctx.log(`${skipped} final zip(s) skipped`);
}

export async function fetchDotax(ctx: FetchContext): Promise<void> {
  const kind = ctx.downloader.config.kind;
  if (kind === "current") return fetchCurrent(ctx);
  if (kind === "archive") return fetchArchive(ctx);
  throw new Error(
    `${ctx.downloader.handle}: config.kind must be "current" or "archive"`,
  );
}
