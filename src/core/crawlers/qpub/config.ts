import { existsSync, readdirSync } from "fs";
import path from "path";

/** Auto-detect NAS mount point (mac / linux / windows) */
function findNASPath(): string {
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
  return "/mnt/UHEROroot/work/scrapes";
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
  RESULTS_DIR: "qpub/results",

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

/** Full path to the HTML directory for a TMK (year/island/zone/section) */
export function getHtmlPath(tmk: string): string {
  const year = String(new Date().getFullYear());
  const island = getIslandCode(tmk);
  const zone = getZone(tmk);
  const section = getSection(tmk);
  return path.join(
    QPUB_CONFIG.NAS_PATH,
    QPUB_CONFIG.HTML_DIR,
    year,
    island,
    zone,
    section,
  );
}

/** Full path to the JSON directory for a TMK (year/island/zone/section) */
export function getJsonPath(tmk: string): string {
  const year = String(new Date().getFullYear());
  const island = getIslandCode(tmk);
  const zone = getZone(tmk);
  const section = getSection(tmk);
  return path.join(
    QPUB_CONFIG.NAS_PATH,
    QPUB_CONFIG.JSON_DIR,
    year,
    island,
    zone,
    section,
  );
}

/** Full path to the results directory for an island (year/island) */
export function getResultsPath(island: string): string {
  const year = String(new Date().getFullYear());
  return path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.RESULTS_DIR, year, island);
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
