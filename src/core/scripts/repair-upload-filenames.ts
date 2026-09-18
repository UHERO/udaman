/**
 * Repair upload rows whose `filename` doesn't match any file on disk.
 *
 * Background: stream-mode uploads create the DB row with the browser's
 * original filename (e.g. "TourismDW_upload.xlsx"). A post-upload /archive
 * call is supposed to save the raw XLSX under a timestamped name and update
 * the row — but archive failures were silent, leaving rows pointing at
 * names that never existed on disk.
 *
 * This script matches each broken row to an unreferenced archive file in
 * the corresponding directory by comparing the timestamp embedded in the
 * filename (written in UTC by the old archive code) against the row's
 * upload_at (HST wall-clock, so shifted +10h), and updates the row.
 *
 * Usage (run on the machine that hosts DATA_DIR, from the repo root):
 *   bun run src/core/scripts/repair-upload-filenames.ts            # dry run
 *   bun run src/core/scripts/repair-upload-filenames.ts --execute  # apply
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { mysql, rawQuery } from "@database/mysql";

import { getDataDir } from "@/lib/data-dir";

const EXECUTE = process.argv.includes("--execute");
const HST_OFFSET_MS = 10 * 3600e3;
// Archive runs right after data load finishes; allow generous processing lag
const WINDOW_BEFORE_MS = 10 * 60e3;
const WINDOW_AFTER_MS = 6 * 3600e3;

type UploadRow = { id: number; filename: string | null; upload_at: Date };

/** Parse "..._YYYY-MM-DD-HHMM_upload..." or "YYYY-MM-DD-HH:MM:SS_..." to epoch ms (as naive wall-clock UTC). */
function filenameTs(name: string): number | null {
  let m = name.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2}):?(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

async function repairTable(table: string, subdir: string) {
  console.log(`\n═══ ${table} (${subdir})`);
  const dir = join(getDataDir(), subdir);
  const disk = existsSync(dir) ? readdirSync(dir) : [];
  const rows = await rawQuery<UploadRow>(
    `SELECT id, filename, upload_at FROM ${table} ORDER BY id`,
  );

  const referenced = new Set(
    rows.map((r) => r.filename).filter((f): f is string => !!f),
  );
  const orphans = disk.filter((d) => !referenced.has(d) && filenameTs(d) !== null);

  for (const r of rows) {
    if (!r.filename) continue;
    if (disk.includes(r.filename)) continue; // resolves fine

    // upload_at is HST wall-clock read as UTC; old archive names embed real
    // UTC → expect file ts ≈ row ts + 10h. Also try 0 offset for any files
    // written after the HST-convention fix.
    const rowMs = new Date(r.upload_at).getTime();
    const candidates = orphans
      .map((o) => ({ name: o, ts: filenameTs(o)! }))
      .filter(({ ts }) =>
        [HST_OFFSET_MS, 0].some(
          (off) =>
            ts >= rowMs + off - WINDOW_BEFORE_MS &&
            ts <= rowMs + off + WINDOW_AFTER_MS,
        ),
      )
      .sort((a, b) => a.ts - b.ts);

    if (candidates.length === 1) {
      const c = candidates[0];
      console.log(`  row ${r.id} "${r.filename}" → ${c.name}`);
      if (EXECUTE) {
        await rawQuery(`UPDATE ${table} SET filename = ? WHERE id = ?`, [
          c.name,
          r.id,
        ]);
        // consume so a later row can't also claim it
      }
      orphans.splice(orphans.indexOf(c.name), 1);
    } else if (candidates.length > 1) {
      console.log(
        `  row ${r.id} "${r.filename}": AMBIGUOUS — ${candidates.map((c) => c.name).join(", ")} (skipped)`,
      );
    } else {
      console.log(
        `  row ${r.id} "${r.filename}" (upload_at ${new Date(r.upload_at).toISOString()}): no archive file on disk — file was likely never archived`,
      );
    }
  }
  if (orphans.length) {
    console.log(`  unclaimed archive files left on disk: ${orphans.length}`);
  }
}

await repairTable("new_dbedt_uploads", "dbedt_files");
await repairTable("dvw_uploads", "dvw_files");
console.log(
  `\n${EXECUTE ? "Applied." : "Dry run — re-run with --execute to apply."}`,
);
process.exit(0);
