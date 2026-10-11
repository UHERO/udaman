/**
 * Download a Data Book edition's 24 section workbooks into
 * data-dir/databook/raw/db{YYYY}/ and record their hashes, so the annual
 * job can tell when DBEDT re-issues the current edition's files (they edit
 * them for weeks after publishing — plan §1.4).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { databookDir } from "./store";

/** First edition published in the flat "accessible" xlsx layout. */
export const FIRST_ACCESSIBLE_EDITION = 2025;

export function rawDir(edition: number): string {
  return join(databookDir(), "raw", `db${edition}`);
}

export function sectionFileName(edition: number, section: number): string {
  const nn = String(section).padStart(2, "0");
  return edition >= FIRST_ACCESSIBLE_EDITION
    ? `DB${edition}_section${nn}.xlsx`
    : `section${nn}.xls`;
}

/**
 * Where an edition's files live. The current edition is under
 * /economic/databook/db{YYYY}/; once superseded DBEDT moves it to
 * /economic/archive/databook/db{YYYY}/ — try current first, then archive.
 */
export function sectionUrls(edition: number, section: number): string[] {
  const f = sectionFileName(edition, section);
  return [
    `https://files.hawaii.gov/dbedt/economic/databook/db${edition}/${f}`,
    `https://files.hawaii.gov/dbedt/economic/archive/databook/db${edition}/${f}`,
  ];
}

export interface FetchResult {
  edition: number;
  files: Array<{
    section: number;
    file: string;
    sha256: string;
    changed: boolean;
  }>;
  /** True when any file differs from the previous fetch. */
  changed: boolean;
}

export async function fetchEdition(edition: number): Promise<FetchResult> {
  const dir = rawDir(edition);
  mkdirSync(dir, { recursive: true });
  const hashFile = join(dir, "hashes.json");
  const previous: Record<string, string> = existsSync(hashFile)
    ? JSON.parse(readFileSync(hashFile, "utf8"))
    : {};
  const hashes: Record<string, string> = {};
  const files: FetchResult["files"] = [];

  for (let section = 1; section <= 24; section++) {
    const name = sectionFileName(edition, section);
    let buf: Buffer | null = null;
    let lastError = "";
    for (const url of sectionUrls(edition, section)) {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (udaman databook)" },
      });
      if (res.ok) {
        buf = Buffer.from(await res.arrayBuffer());
        break;
      }
      lastError = `${res.status} ${url}`;
    }
    if (!buf)
      throw new Error(`Data Book ${edition} section ${section}: ${lastError}`);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    writeFileSync(join(dir, name), buf);
    hashes[name] = sha256;
    files.push({
      section,
      file: join(dir, name),
      sha256,
      changed: previous[name] !== sha256,
    });
  }

  writeFileSync(hashFile, JSON.stringify(hashes, null, 1) + "\n");
  return { edition, files, changed: files.some((f) => f.changed) };
}
