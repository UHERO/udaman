/**
 * Acquire the DBEDT Data Book: every edition's 24 section workbooks, stored
 * as is under the key `db<YYYY>/section<NN>`.
 *
 * Downloader config: { firstEdition?: 2002 }
 *
 * The current edition lives under /economic/databook/db<YYYY>/; once a
 * newer edition is out DBEDT moves it to /economic/archive/databook/. Each
 * run tries the current location first, then the archive.
 *
 *  - Editions older than the newest stored one are final after their next
 *    fetch: the archive doesn't change.
 *  - The newest edition is refetched every run: DBEDT edits its files for
 *    weeks after publishing, and an edit is a new vintage.
 *  - The edition after the newest is probed every run: until DBEDT
 *    publishes it (around August of the following year) its first section
 *    is a 404, which is not a failure.
 */

import { HttpError } from "../../http";
import type { FetchContext } from "../../types";
import { FIRST_EDITION, sectionFileName, SECTIONS } from "./edition";

const BASE = "https://files.hawaii.gov/dbedt/economic";
/** Politeness between files. */
const FILE_DELAY_MS = 250;

export function databookKey(edition: number, section: number): string {
  return `db${edition}/section${String(section).padStart(2, "0")}`;
}

export function parseDatabookKey(
  key: string,
): { edition: number; section: number } | null {
  const m = key.match(/^db(\d{4})\/section(\d{2})$/);
  return m ? { edition: Number(m[1]), section: Number(m[2]) } : null;
}

export function sectionUrls(edition: number, section: number): string[] {
  const f = sectionFileName(edition, section);
  return [
    `${BASE}/databook/db${edition}/${f}`,
    `${BASE}/archive/databook/db${edition}/${f}`,
  ];
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const notFound = (e: unknown) =>
  e instanceof HttpError && (e.status === 404 || e.status === 403);

/** Download one section from the first location that has it. */
async function fetchSection(
  ctx: FetchContext,
  edition: number,
  section: number,
  final: boolean,
): Promise<"stored" | "missing"> {
  const key = databookKey(edition, section);
  let lastError: unknown = null;
  for (const url of sectionUrls(edition, section)) {
    try {
      await ctx.download(url, key, {
        originalName: sectionFileName(edition, section),
        metadata: { edition, section },
        final,
      });
      return "stored";
    } catch (e) {
      lastError = e;
      if (!notFound(e)) break;
    }
  }
  if (notFound(lastError)) return "missing";
  throw lastError;
}

export async function fetchDatabook(ctx: FetchContext): Promise<void> {
  const firstEdition = Number(
    ctx.downloader.config.firstEdition ?? FIRST_EDITION,
  );
  const finals = ctx.full ? new Set<string>() : await ctx.finalKeys();

  // The newest edition already stored (or the year before the first).
  let newest = firstEdition - 1;
  for (let y = new Date().getFullYear(); y >= firstEdition; y--) {
    if (await ctx.latest(databookKey(y, 1))) {
      newest = y;
      break;
    }
  }

  // A new edition is published when its first section is there.
  const thisYear = new Date().getFullYear();
  let last = newest;
  for (let y = Math.max(newest + 1, firstEdition); y < thisYear; y++) {
    await ctx.sleep(FILE_DELAY_MS);
    let found = false;
    for (const url of sectionUrls(y, 1)) {
      try {
        await ctx.get(url, { method: "HEAD" });
        found = true;
        break;
      } catch (e) {
        if (!notFound(e)) throw e;
      }
    }
    if (!found) break;
    last = y;
    ctx.log(`edition ${y} is published`);
  }
  if (last < firstEdition) throw new Error("no Data Book edition found");

  let skipped = 0;
  for (let edition = firstEdition; edition <= last; edition++) {
    for (let section = 1; section <= SECTIONS; section++) {
      const key = databookKey(edition, section);
      if (finals.has(key)) {
        skipped++;
        continue;
      }
      await ctx.sleep(FILE_DELAY_MS);
      try {
        const got = await fetchSection(ctx, edition, section, edition < last);
        if (got === "missing")
          ctx.keyFailed(
            key,
            `not found at ${sectionUrls(edition, section).join(" or ")}`,
          );
      } catch (e) {
        ctx.keyFailed(key, errMsg(e));
      }
    }
  }
  ctx.log(`${skipped} final file(s) skipped; newest edition ${last}`);
}
