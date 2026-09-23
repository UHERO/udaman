/**
 * Raw-HTML cache and run artifacts for the DCCA scraper.
 *
 *   {root}/index/{YYYY-MM-DD}.html         the whole register, one snapshot per day
 *   {root}/profiles/{reg}/{YYYY-MM-DD}.html dated profile snapshots; latest is current
 *   {root}/runs/{YYYY-MM-DD}-list.json     registration list from that day's index
 *   {root}/runs/{YYYY-MM-DD}-report.csv    match / load outcome per profile
 *
 * Root: DCCA_NAS_PATH if set, else <NAS scrapes root>/dcca. When the NAS is
 * not mounted the cache falls back to a temp dir so a smoke test still runs;
 * the pipeline logs where it landed.
 */

import { existsSync } from "fs";
import { mkdir, readdir, readFile, rename, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import { findScrapesRoot } from "../nas-path";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REG_RE = /^\d{1,8}$/;

export function dccaCacheRoot(): { root: string; onNas: boolean } {
  const override = process.env.DCCA_NAS_PATH?.trim();
  if (override) return { root: override, onNas: true };
  const scrapes = findScrapesRoot();
  if (existsSync(scrapes))
    return { root: path.join(scrapes, "dcca"), onNas: true };
  return { root: path.join(os.tmpdir(), "udaman-dcca"), onNas: false };
}

function checkDate(date: string): string {
  if (!DATE_RE.test(date)) throw new Error(`bad date: ${date}`);
  return date;
}

function checkReg(reg: string): string {
  if (!REG_RE.test(reg)) throw new Error(`bad registration number: ${reg}`);
  return reg;
}

export function indexPath(root: string, date: string): string {
  return path.join(root, "index", `${checkDate(date)}.html`);
}

export function profilePath(root: string, reg: string, date: string): string {
  return path.join(root, "profiles", checkReg(reg), `${checkDate(date)}.html`);
}

export function listJsonPath(root: string, date: string): string {
  return path.join(root, "runs", `${checkDate(date)}-list.json`);
}

export function reportCsvPath(root: string, date: string): string {
  return path.join(root, "runs", `${checkDate(date)}-report.csv`);
}

/** Atomic write: temp file in the same dir, then rename. */
export async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, file);
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Newest dated snapshot of a profile, or null when none is cached. */
export async function latestProfileSnapshot(
  root: string,
  reg: string,
): Promise<{ date: string; file: string } | null> {
  const dir = path.join(root, "profiles", checkReg(reg));
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const dates = names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.html$/.test(n))
    .map((n) => n.slice(0, 10))
    .sort();
  const date = dates.at(-1);
  return date ? { date, file: profilePath(root, reg, date) } : null;
}

/** Every registration number that has at least one cached profile. */
export async function cachedRegs(root: string): Promise<string[]> {
  try {
    const names = await readdir(path.join(root, "profiles"));
    return names
      .filter((n) => REG_RE.test(n))
      .sort((a, b) => Number(a) - Number(b));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
