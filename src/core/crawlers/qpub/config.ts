import { existsSync, readdirSync, statSync } from "fs";
import path from "path";

/**
 * Auto-detect NAS mount point (mac / linux / windows).
 *
 * QPUB_NAS_PATH overrides the search — for a machine that mounts the share
 * somewhere unusual, and for dry-running the repair pass against a copy.
 */
function findNASPath(): string {
  const override = process.env.QPUB_NAS_PATH?.trim();
  if (override) return override;

  const platform = process.platform;

  if (platform === "darwin") {
    const defaultPath = "/Volumes/UHEROroot/work/scrapes";
    if (existsSync(defaultPath)) return defaultPath;

    try {
      for (const volume of readdirSync("/Volumes")) {
        const testPath = `/Volumes/${volume}/work/scrapes`;
        if (existsSync(testPath)) return testPath;
      }
    } catch {
      // can't read /Volumes — fall through
    }

    return defaultPath;
  }

  if (platform === "win32") {
    const letters = "ZYXWVUTSRQPONM".split("");
    for (const l of letters) {
      const testPath = `${l}:\\work\\scrapes`;
      if (existsSync(testPath)) return testPath;
    }

    const uncPath = "\\\\UHEROroot\\work\\scrapes";
    if (existsSync(uncPath)) return uncPath;

    return "Z:\\work\\scrapes";
  }

  // Linux / other
  return "/Volumes/UHEROroot/work/scrapes";
}

// ─── Island lookup ────────────────────────────────────────────────────

export const ISLANDS = {
  "1": "Oahu",
  "2": "Maui",
  "3": "Hawaii",
  "4": "Kauai",
} as const;

export type IslandCode = keyof typeof ISLANDS;

// ─── URL builders (one per island) ────────────────────────────────────

/**
 * Convert internal TMK (I-ZZ-SSS-PPP-CCCC) to qPub parcel number (ZZSSSPPPCCCC).
 * Strips the island code (first digit) and removes all hyphens.
 */
export function tmkToParcelNumber(tmk: string): string {
  // Remove the island code (first segment) and all hyphens
  const parts = tmk.split("-");
  // Drop the first part (island code), join the rest without hyphens
  return parts.slice(1).join("");
}

/**
 * Widths of the fixed head of a parcel number: zone, section, plat, parcel.
 * Whatever follows is the CPR suffix.
 */
const PARCEL_HEAD_WIDTHS = [1, 1, 3, 3] as const;
const PARCEL_HEAD_LENGTH = 8;

/** CPR suffix lengths qPublic actually serves: 4 normally, 5 for "0000A". */
const CPR_LENGTHS = [4, 5];

/**
 * Convert a qPub parcel number (ZSPPPPPPCCCC) back to an internal TMK.
 *
 * The strict inverse of tmkToParcelNumber, and the only sanctioned way to turn
 * a parcel number into a TMK: the island code is supplied because it is the
 * one thing the parcel number does not carry, and nothing else is invented.
 * Returns null for anything that isn't a parcel number — a caller that cannot
 * read an identifier must skip the row and say so, never guess the rest of it
 * from a CPR suffix or a neighbouring TMK.
 *
 * The CPR runs to the end of the string rather than being pinned at four
 * characters: State of Hawaii and Hawaiian Home Lands parcels appear on condo
 * rosters as 13-character numbers ending "0000A", and taking a fixed four
 * would silently truncate one to "000A" — a different, and non-existent,
 * parcel.
 */
export function tmkFromParcelNumber(
  parcelNumber: string,
  islandCode: string,
): string | null {
  const parcel = parcelNumber.trim();
  if (!/^[0-9A-Za-z]+$/.test(parcel)) return null;
  if (!CPR_LENGTHS.includes(parcel.length - PARCEL_HEAD_LENGTH)) return null;

  const segments: string[] = [islandCode];
  let at = 0;
  for (const width of PARCEL_HEAD_WIDTHS) {
    segments.push(parcel.slice(at, at + width));
    at += width;
  }
  segments.push(parcel.slice(PARCEL_HEAD_LENGTH));
  return segments.join("-");
}

const BASE_URLS: Record<IslandCode, (parcel: string) => string> = {
  "1": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1045&LayerID=23342&PageTypeID=4&PageID=9746&KeyValue=${parcel}`,
  "2": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&LayerID=21689&PageTypeID=4&PageID=9251&Q=665264273&KeyValue=${parcel}`,
  "3": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1048&LayerID=23618&PageTypeID=4&PageID=9878&Q=252788940&KeyValue=${parcel}`,
  "4": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=986&LayerID=20101&PageTypeID=4&PageID=8744&Q=1302490479&KeyValue=${parcel}`,
};

// ─── Main config ──────────────────────────────────────────────────────

export const QPUB_CONFIG = {
  NAS_PATH: findNASPath(),
  HTML_DIR: "qpub/html",
  JSON_DIR: "qpub/json",

  DELAY_MIN: 4_000,
  DELAY_MAX: 20_000,
  MAX_RETRIES: 3,

  BLOCKED_HOURS: {
    BACKUP: { start: 19, end: 20 },
    NIGHT: { start: 23, end: 5 },
  },

  ISLANDS,
  BASE_URLS,
} as const;

// ─── Scrape periods ──────────────────────────────────────────────

/**
 * Scrape period: '2026-1' (Mar–Aug) or '2026-2' (Sep–Dec).
 * Throws if called in Jan or Feb (county update / blocked months).
 *
 * August used to be blocked alongside Jan/Feb. It now belongs to period 1 so
 * a pass that started in March keeps writing into the same {period} directory
 * rather than splitting across two mid-run.
 */
export function getScrapePeriod(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  if (month >= 3 && month <= 8) return `${year}-1`;
  if (month >= 9 && month <= 12) return `${year}-2`;
  throw new Error(`No active scrape period in month ${month}`);
}

/** Whether scraping is currently allowed (blocked in Jan and Feb) */
export function isScrapePeriodActive(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1;
  return month >= 3 && month <= 12;
}

// ─── TMK helpers ──────────────────────────────────────────────────────

/** Extract island code (first segment) from a TMK string */
export function getIslandCode(tmk: string): string {
  return tmk.split("-")[0];
}

/** Extract zone (second segment) from a TMK string */
export function getZone(tmk: string): string {
  return tmk.split("-")[1];
}

/** Extract section (third segment) from a TMK string */
export function getSection(tmk: string): string {
  return tmk.split("-")[2];
}

/** Get island name from code */
export function getIslandName(code: string): string {
  return ISLANDS[code as IslandCode] ?? "Unknown";
}

/** Full path to the HTML directory for a TMK (period/island/zone/section) */
export function getHtmlPath(tmk: string): string {
  const period = getScrapePeriod();
  const island = getIslandCode(tmk);
  const zone = getZone(tmk);
  const section = getSection(tmk);
  return path.join(
    QPUB_CONFIG.NAS_PATH,
    QPUB_CONFIG.HTML_DIR,
    period,
    island,
    zone,
    section,
  );
}

/** Full path to the JSON directory for a TMK (period/island/zone/section) */
export function getJsonPath(tmk: string): string {
  const period = getScrapePeriod();
  const island = getIslandCode(tmk);
  const zone = getZone(tmk);
  const section = getSection(tmk);
  return path.join(
    QPUB_CONFIG.NAS_PATH,
    QPUB_CONFIG.JSON_DIR,
    period,
    island,
    zone,
    section,
  );
}

/** Build QPub URL for a TMK on a given island */
export function buildUrl(tmk: string, island: IslandCode): string {
  const parcel = tmkToParcelNumber(tmk);
  return BASE_URLS[island](parcel);
}

/** Normalize a TMK to canonical I-ZZ-SSS-PPP-CCCC format */
export function normalizeTMK(tmk: string, islandCode: string): string {
  const cleaned = tmk.replace(".html", "");
  const parts = cleaned.split(/[-/]/);

  if (parts[0] !== islandCode) {
    parts.unshift(islandCode);
  }

  while (parts.length < 6) {
    parts.push("0000");
  }

  if (parts.length === 6 && parts[5].length < 4) {
    parts[5] = parts[5].padStart(4, "0");
  }

  return parts.join("-");
}

// ─── Blocked-time checks ─────────────────────────────────────────────

/** True during backup window (7–8 PM) */
export function isBackupTime(): boolean {
  const h = new Date().getHours();
  return (
    h >= QPUB_CONFIG.BLOCKED_HOURS.BACKUP.start &&
    h < QPUB_CONFIG.BLOCKED_HOURS.BACKUP.end
  );
}

/** True during night block (11 PM – 5 AM) */
export function isNighttime(): boolean {
  const h = new Date().getHours();
  return (
    h >= QPUB_CONFIG.BLOCKED_HOURS.NIGHT.start ||
    h < QPUB_CONFIG.BLOCKED_HOURS.NIGHT.end
  );
}

/** True if in any blocked period */
export function isBlockedTime(): boolean {
  return isBackupTime() || isNighttime();
}

// ─── NAS file enumeration ─────────────────────────────────────────

/** Safely list a directory, returning empty array if it doesn't exist */
function safeDirList(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** Period directories present on the NAS, newest first (e.g. ['2026-1','2025-2']) */
export function listPeriods(): string[] {
  const baseDir = path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.HTML_DIR);
  return safeDirList(baseDir)
    .filter((d) => /^\d{4}-[12]$/.test(d))
    .sort()
    .reverse();
}

/**
 * Newest period directory on the NAS, or null when none exist.
 *
 * Read off disk rather than derived from getScrapePeriod(): a pass that runs
 * past its calendar period keeps writing into the directory it started in, so
 * the newest directory is what's actually being filled — which is not always
 * the period today's date maps to.
 */
export function latestPeriod(): string | null {
  return listPeriods()[0] ?? null;
}

/**
 * Lazily enumerate HTML files from the NAS directory structure.
 * Yields absolute paths: {NAS}/qpub/html/{period}/{island}/{zone}/{section}/{tmk}.html
 *
 * With no `period`, periods come out newest-first (via listPeriods) rather than
 * in readdir order. Callers that fold the stream into a per-TMK map depend on
 * that: readdir happened to return ['2026-1','2025-2'], so a last-write-wins
 * map silently preferred the older file for every TMK present in both.
 */
export function* listHtmlFiles(
  period?: string,
  island?: string,
): Generator<string> {
  const baseDir = path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.HTML_DIR);
  const periods = period ? [period] : listPeriods();

  for (const p of periods) {
    const periodDir = path.join(baseDir, p);
    const islands = island ? [island] : safeDirList(periodDir);
    for (const i of islands) {
      const islandDir = path.join(periodDir, i);
      for (const zone of safeDirList(islandDir)) {
        const zoneDir = path.join(islandDir, zone);
        for (const section of safeDirList(zoneDir)) {
          const sectionDir = path.join(zoneDir, section);
          if (!statSync(sectionDir).isDirectory()) continue;
          for (const file of safeDirList(sectionDir)) {
            if (file.endsWith(".html")) {
              yield path.join(sectionDir, file);
            }
          }
        }
      }
    }
  }
}

/** Extract TMK from an HTML file path (filename without extension) */
export function tmkFromFilePath(filePath: string): string {
  return path.basename(filePath, ".html");
}

/** Get the file's mtime as a Date (used for scrapedAt in reparse) */
export function getFileMtime(filePath: string): Date {
  return statSync(filePath).mtime;
}

/** Milliseconds until the current blocked window ends */
export function msUntilUnblocked(): number {
  const now = new Date();
  const end = new Date(now);

  if (isBackupTime()) {
    end.setHours(QPUB_CONFIG.BLOCKED_HOURS.BACKUP.end, 0, 0, 0);
    return end.getTime() - now.getTime();
  }

  // nighttime — ends at 5 AM (possibly next day)
  if (now.getHours() >= QPUB_CONFIG.BLOCKED_HOURS.NIGHT.start) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(QPUB_CONFIG.BLOCKED_HOURS.NIGHT.end, 0, 0, 0);
  return end.getTime() - now.getTime();
}
