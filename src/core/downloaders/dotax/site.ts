/**
 * tax.hawaii.gov report pages — port of rprocess dotax_download.R's page
 * and inventory helpers. The report pages are found by link text starting
 * at https://tax.hawaii.gov/stats/ (the page slugs are not assumed to be
 * stable).
 *  - "Current Monthly Tax Reports": one XLSX per report per month for
 *    roughly the last two fiscal years. DOTAX revises these both by
 *    renaming (202508fuels_rev.xlsx, ..._corr.xlsx) and in place under the
 *    same name.
 *  - "Archived Full Monthly Reports By Year": one zip per month (the
 *    spreadsheets are only available inside the zips). A revised month
 *    gets a new zip name (2018-05_rev.zip, ..._rev2.zip).
 * Politeness: tax.hawaii.gov has Crawl-delay 10 (2-3 page requests per
 * run); file requests are spaced 1 s apart.
 */

import { parse } from "node-html-parser";
import type { HTMLElement, Node } from "node-html-parser";

import type { ReportType } from "./parse";

export const STATS_URL = "https://tax.hawaii.gov/stats/";
export const PAGE_DELAY_MS = 10_000;
export const FILE_DELAY_MS = 1_000;
const UA = "Mozilla/5.0 (compatible; UDAMAN/1.0; UHERO Data Manager)";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastPageAt = 0;

/** GET an html page from tax.hawaii.gov, honoring its crawl delay. */
export async function fetchPage(url: string): Promise<HTMLElement> {
  const wait = lastPageAt + PAGE_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastPageAt = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return parse(await res.text());
}

/** HEAD request: does this URL exist? (archive gap guesses) */
export async function urlExists(url: string): Promise<boolean> {
  await sleep(FILE_DELAY_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

const squish = (s: string) => s.replace(/\s+/g, " ").trim();
const textOf = (el: HTMLElement | null | undefined) =>
  squish(el?.textContent ?? "");

/** Absolute href of the first link whose text matches `pattern`. */
export function findLink(
  page: HTMLElement,
  pattern: RegExp,
  pageName: string,
): string {
  for (const a of page.querySelectorAll("a")) {
    if (pattern.test(textOf(a))) {
      const href = a.getAttribute("href");
      if (href) return new URL(href, STATS_URL).toString();
    }
  }
  throw new Error(
    `dotax: no link matching ${pattern} on ${pageName} - has the DOTAX site changed?`,
  );
}

/** "August 2026" → "2026-08"; anything else (FY / CY summaries) → null. */
export function periodMonth(x: string): string | null {
  const m = squish(x).match(/^([A-Za-z]+) (\d{4})$/);
  if (!m) return null;
  const i = MONTHS.indexOf(m[1].toLowerCase());
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

export type CurrentItem = {
  url: string;
  month: string;
  title: string;
  revisedNote: string;
};

/**
 * One row per XLSX link on "Current Monthly Tax Reports". Each month is its
 * own <table> with the month in the first <th>; each report is a row of
 * title | PDF | XLSX. One month's table has a missing <tr> (loose <td>s),
 * so rows are found from the links: the title is the nearest preceding
 * <td> without a link (XPath preceding::td[not(.//a)][1]).
 */
export function currentCatalog(page: HTMLElement): CurrentItem[] {
  const out: CurrentItem[] = [];
  const seen = new Set<string>();
  let lastPlainTd = "";
  const tableStack: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (tag === "table") tableStack.push(textOf(el.querySelector("th")));
    if (tag === "a") {
      const href = el.getAttribute("href") ?? "";
      if (
        tableStack.length &&
        href.includes("files.hawaii.gov/tax/stats/monthly/") &&
        /\.xlsx?$/i.test(href)
      ) {
        const month = periodMonth(tableStack[tableStack.length - 1]);
        const titleRaw = squish(lastPlainTd);
        if (month && !seen.has(href)) {
          seen.add(href);
          const note =
            titleRaw.match(/\((Revised|Corrected)[^)]*\)/)?.[0] ?? "";
          out.push({
            url: href,
            month,
            title: squish(titleRaw.replace(/\((Revised|Corrected)[^)]*\)/, "")),
            revisedNote: note,
          });
        }
      }
    }
    for (const child of el.childNodes) walk(child);
    if (tag === "td" && !el.querySelector("a")) lastPlainTd = textOf(el);
    if (tag === "table") tableStack.pop();
  };
  walk(page);
  return out;
}

export type ArchiveItem = { url: string; month: string };

/**
 * One row per monthly zip on "Archived Full Monthly Reports By Year" (row
 * label in the first cell, links in the second). The zip name's month wins
 * over the row label: the page has linked a month's row to the previous
 * month's zip (November 2002 → 2002-10.zip).
 */
export function archiveCatalog(
  page: HTMLElement,
  firstMonth: string,
): ArchiveItem[] {
  const out: ArchiveItem[] = [];
  const seen = new Set<string>();
  for (const tr of page.querySelectorAll("table tr")) {
    const zips = tr
      .querySelectorAll("a")
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.includes(".zip"));
    if (!zips.length) continue;
    const period = textOf(tr.querySelector("td"));
    for (const href of zips) {
      const url = new URL(href, STATS_URL).toString();
      const file = decodeURIComponent(url.split("/").pop() ?? "");
      const zm = file.match(/^(\d{4})-(\d{2})/);
      const month = zm ? `${zm[1]}-${zm[2]}` : periodMonth(period);
      if (!month || month < firstMonth || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, month });
    }
  }
  return out;
}

/**
 * Report type from a file name, or null for anything not parsed
 * (summaries, PDFs, retired reports, docs). The leading date prefix (MM,
 * YYMM or YYYYMM) is dropped first; DOTAX's one-off misspellings are
 * covered.
 */
export function reportType(fileName: string): ReportType | null {
  const lower = fileName.toLowerCase();
  if (!/\.xlsx?$/.test(lower)) return null;
  const stem = lower
    .replace(/(\.xlsx?)+$/, "")
    .replace(/^\d{2,6}/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(cal|cy|fis|fy|is)/.test(stem)) return null;
  if (/^(liab|lab)[-_ ]*(by|b)?[-_ ]*(d)?[-_ ]*ge([-_ ]|$)|^ge liab/.test(stem))
    return "liab_ge";
  if (
    /^(liab|lab)[-_ ]*(by|b)?[-_ ]*(d)?[-_ ]*tat([-_ ]|$)|^tat liab/.test(stem)
  )
    return "liab_tat";
  if (/^liqtob/.test(stem)) return "liqtob";
  if (/^liq([-_ ]|$)/.test(stem)) return "liq";
  if (/^tob([-_ ]|$)/.test(stem)) return "tob";
  if (/^(fuels?|fules|f-coll|f-fuel)([-_ ]|$)/.test(stem)) return "fuels";
  if (/^ge([-_ ]|$)|^ge tax & base/.test(stem)) return "ge";
  if (/^(collec|collall|coll)([-_ ]|$)/.test(stem)) return "collec";
  return null;
}

/** Revision rank from a file name: plain 0, _rev 1, _revN N, _corr 99. */
export function revRank(fileName: string): number {
  const stem = fileName.toLowerCase().replace(/(\.xlsx?)+$/, "");
  if (stem.includes("corr")) return 99;
  const n = stem.match(/_rev(\d+)/);
  if (n) return Number(n[1]);
  if (stem.includes("_rev")) return 1;
  return 0;
}

export type InventoryFile = {
  type: ReportType;
  month: string;
  file: string;
  path: string;
  /** Groups files from one zip / one URL */
  source: string;
  /** Epoch ms; newest wins */
  fileDate: number;
};

/**
 * One file per (type, month): the source with the newest file date wins,
 * then the highest revision marker, then the newest file.
 */
export function pickPerMonth(files: InventoryFile[]): InventoryFile[] {
  const sourceDate = new Map<string, number>();
  for (const f of files) {
    const k = `${f.type}\r${f.month}\r${f.source}`;
    sourceDate.set(k, Math.max(sourceDate.get(k) ?? -Infinity, f.fileDate));
  }
  const best = new Map<string, InventoryFile>();
  const score = (f: InventoryFile) =>
    [
      sourceDate.get(`${f.type}\r${f.month}\r${f.source}`) ?? 0,
      revRank(f.file),
      f.fileDate,
    ] as const;
  for (const f of files) {
    const k = `${f.type}\r${f.month}`;
    const cur = best.get(k);
    if (!cur) {
      best.set(k, f);
      continue;
    }
    const a = score(f);
    const b = score(cur);
    if (
      a[0] > b[0] ||
      (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
    ) {
      best.set(k, f);
    }
  }
  return [...best.values()].sort((x, y) =>
    x.type === y.type
      ? x.month.localeCompare(y.month)
      : x.type.localeCompare(y.type),
  );
}

/** Months between a and b inclusive (YYYY-MM). */
export function monthRange(a: string, b: string): string[] {
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number);
  const [ey, em] = b.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
