/**
 * tax.hawaii.gov report pages — navigation for the DOTAX fetch (port of
 * rprocess dotax_download.R's page helpers). The report pages are found
 * by link text starting at https://tax.hawaii.gov/stats/ (the page slugs
 * are not assumed to be stable).
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

import type { HTMLElement, Node } from "node-html-parser";

export const STATS_URL = "https://tax.hawaii.gov/stats/";

export const PAGE_DELAY_MS = 10_000;

export const FILE_DELAY_MS = 1_000;

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
