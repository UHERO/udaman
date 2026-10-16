/**
 * Config-driven fetch strategies. A simple source needs only a
 * data_downloaders row:
 *
 * static_url — a fixed URL, optionally with date patterns:
 *   { "url": "https://example.gov/jobs/%Y.xls",
 *     "periods": { "frequency": "year", "start": "2009" },  // optional
 *     "key": "%Y",            // artifact key pattern; default: the file name
 *     "liveRecent": 2,        // keys older than the newest N periods are marked final
 *     "optionalRecent": 1,    // a 404 for the newest N periods is a warning, not a failure
 *     "delayMs": 1000 }
 *
 * discover_from_page — find the file link(s) on a stable landing page:
 *   { "page": "https://example.gov/stats/",
 *     "via": [{ "text": "^Current Monthly Reports$" }],   // follow links first (optional)
 *     "link": { "text": "Jobs", "href": "\\.xlsx?$" },    // regexes, case-insensitive
 *     "multiple": false,      // every matching link, or the first
 *     "key": "filename",      // filename | text | href
 *     "delayMs": 1000 }
 *
 * custom — the source module's own fetch().
 */

import type DataDownloader from "@catalog/models/data-downloader";
import type { HTMLElement } from "node-html-parser";

import { HttpError } from "./http";
import type { FetchContext, SourceModule } from "./types";

// ─── Date patterns ─────────────────────────────────────────────────

export type PeriodFrequency = "year" | "quarter" | "month";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_NAME = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** strftime subset used by the existing %Y download handles. */
export function formatPattern(pattern: string, d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return pattern.replace(/%([YymbBdq%])/g, (_, c: string) => {
    switch (c) {
      case "Y":
        return String(y);
      case "y":
        return String(y % 100).padStart(2, "0");
      case "m":
        return String(m + 1).padStart(2, "0");
      case "b":
        return MONTH_ABBR[m];
      case "B":
        return MONTH_NAME[m];
      case "d":
        return String(d.getUTCDate()).padStart(2, "0");
      case "q":
        return String(Math.floor(m / 3) + 1);
      default:
        return "%";
    }
  });
}

/** "2009", "2009-03" or "2009-03-01" → a UTC date at the period start. */
export function parsePeriodStart(s: string): Date {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s.trim());
  if (!m)
    throw new Error(`bad period date "${s}" (use YYYY, YYYY-MM or YYYY-MM-DD)`);
  return new Date(Date.UTC(+m[1], m[2] ? +m[2] - 1 : 0, 1));
}

/** Period starts from start through end, oldest first. */
export function periodsBetween(
  start: Date,
  end: Date,
  frequency: PeriodFrequency,
): Date[] {
  const step = frequency === "year" ? 12 : frequency === "quarter" ? 3 : 1;
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  if (frequency === "year") m = 0;
  if (frequency === "quarter") m -= m % 3;
  const out: Date[] = [];
  for (;;) {
    const d = new Date(Date.UTC(y, m, 1));
    if (d > end) break;
    out.push(d);
    m += step;
    y += Math.floor(m / 12);
    m %= 12;
    if (out.length > 10_000) throw new Error("too many periods");
  }
  return out;
}

function fileNameOf(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    return decodeURIComponent(last) || url;
  } catch {
    return url;
  }
}

const numberOr = (v: unknown, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

// ─── static_url ────────────────────────────────────────────────────

export async function fetchStaticUrl(
  ctx: FetchContext,
  today: Date = new Date(),
): Promise<void> {
  const c = ctx.downloader.config;
  const urlPattern = typeof c.url === "string" ? c.url : "";
  if (!urlPattern) throw new Error("static_url: config.url is not set");
  const keyPattern = typeof c.key === "string" ? c.key : null;
  const delayMs = numberOr(c.delayMs, 1000);

  const p = c.periods as
    { frequency?: PeriodFrequency; start?: string; end?: string } | undefined;
  if (!p) {
    const key = keyPattern ?? fileNameOf(urlPattern);
    await ctx.download(urlPattern, key);
    return;
  }

  const frequency = p.frequency ?? "year";
  if (!["year", "quarter", "month"].includes(frequency)) {
    throw new Error(`static_url: unknown periods.frequency "${frequency}"`);
  }
  if (!p.start) throw new Error("static_url: periods.start is not set");
  const periods = periodsBetween(
    parsePeriodStart(p.start),
    p.end ? parsePeriodStart(p.end) : today,
    frequency,
  );
  const liveRecent = numberOr(c.liveRecent, 2);
  const optionalRecent = numberOr(c.optionalRecent, 1);
  const finals = ctx.full ? new Set<string>() : await ctx.finalKeys();

  // newest first: the live periods are the ones that matter most
  const newestFirst = [...periods].reverse();
  let first = true;
  for (const [i, d] of newestFirst.entries()) {
    const url = formatPattern(urlPattern, d);
    const key = keyPattern ? formatPattern(keyPattern, d) : fileNameOf(url);
    if (finals.has(key)) continue;
    if (!first) await ctx.sleep(delayMs);
    first = false;
    try {
      await ctx.download(url, key, { final: i >= liveRecent });
    } catch (e) {
      if (e instanceof HttpError && e.status === 404 && i < optionalRecent) {
        ctx.warn(`${key}: not published yet (404)`);
        continue;
      }
      ctx.keyFailed(key, e instanceof Error ? e.message : String(e));
    }
  }
}

// ─── discover_from_page ────────────────────────────────────────────

type LinkSpec = { text?: string; href?: string };

const squish = (s: string) => s.replace(/\s+/g, " ").trim();

/** Links on `page` matching a spec, as absolute URLs with their text. */
export function findLinks(
  page: HTMLElement,
  pageUrl: string,
  spec: LinkSpec,
): Array<{ url: string; text: string }> {
  if (!spec.text && !spec.href) {
    throw new Error("a link spec needs text and/or href");
  }
  const textRe = spec.text ? new RegExp(spec.text, "i") : null;
  const hrefRe = spec.href ? new RegExp(spec.href, "i") : null;
  const out: Array<{ url: string; text: string }> = [];
  const seen = new Set<string>();
  for (const a of page.querySelectorAll("a")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const text = squish(a.textContent ?? "");
    if (textRe && !textRe.test(text)) continue;
    if (hrefRe && !hrefRe.test(href)) continue;
    let url: string;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, text });
  }
  return out;
}

export async function fetchDiscoverFromPage(ctx: FetchContext): Promise<void> {
  const c = ctx.downloader.config;
  const start = typeof c.page === "string" ? c.page : "";
  if (!start) throw new Error("discover_from_page: config.page is not set");
  const link = c.link as LinkSpec | undefined;
  if (!link) throw new Error("discover_from_page: config.link is not set");
  const via = (Array.isArray(c.via) ? c.via : []) as LinkSpec[];
  const delayMs = numberOr(c.delayMs, 1000);
  const keyBy = (typeof c.key === "string" ? c.key : "filename") as
    "filename" | "text" | "href";

  let pageUrl = start;
  let page = await ctx.getPage(pageUrl);
  for (const step of via) {
    const next = findLinks(page, pageUrl, step)[0];
    if (!next) {
      throw new Error(
        `discover_from_page: no link matching ${JSON.stringify(step)} on ${pageUrl} - has the page changed?`,
      );
    }
    await ctx.sleep(delayMs);
    pageUrl = next.url;
    page = await ctx.getPage(pageUrl);
  }

  let links = findLinks(page, pageUrl, link);
  if (links.length === 0) {
    throw new Error(
      `discover_from_page: no link matching ${JSON.stringify(link)} on ${pageUrl} - has the page changed?`,
    );
  }
  if (c.multiple !== true) links = links.slice(0, 1);
  const finals = ctx.full ? new Set<string>() : await ctx.finalKeys();
  for (const l of links) {
    const key =
      keyBy === "text" ? l.text : keyBy === "href" ? l.url : fileNameOf(l.url);
    if (finals.has(key)) continue;
    await ctx.sleep(delayMs);
    try {
      await ctx.download(l.url, key, { metadata: { linkText: l.text } });
    } catch (e) {
      ctx.keyFailed(key, e instanceof Error ? e.message : String(e));
    }
  }
}

// ─── dispatch ──────────────────────────────────────────────────────

export async function runStrategy(
  downloader: DataDownloader,
  ctx: FetchContext,
  sourceFor: (key: string) => SourceModule,
): Promise<void> {
  switch (downloader.strategy) {
    case "static_url":
      return fetchStaticUrl(ctx);
    case "discover_from_page":
      return fetchDiscoverFromPage(ctx);
    case "custom": {
      if (!downloader.sourceKey) {
        throw new Error(
          `${downloader.handle}: strategy "custom" needs a source_key`,
        );
      }
      const source = sourceFor(downloader.sourceKey);
      if (!source.fetch) {
        throw new Error(
          `${downloader.handle}: source module "${source.key}" has no fetch()`,
        );
      }
      return source.fetch(ctx);
    }
  }
}
