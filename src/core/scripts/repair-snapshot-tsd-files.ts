/**
 * Repair forecast-snapshot TSD files stranded under wrong hashed filenames.
 *
 * Background: the on-disk name is `md5("<created_at UTC>_<id>_<filename>")_<filename>`.
 * A since-fixed bug computed the hash with machine-local time accessors, so files
 * written while it was live landed under a name shifted by the host's UTC offset
 * (-10h on HST). After the fix, reads compute the correct hash and miss them.
 *
 * This script:
 *   1. Finds every snapshot file reference that does not resolve on disk.
 *   2. Scans DATA_DIR/tsd_files for unreferenced files whose original-filename
 *      suffix matches, and attributes them by brute-forcing the known buggy
 *      hash variants (falling back to suffix match if the hash is unattributable).
 *   3. Copies (never moves/deletes) each orphan to the correct name.
 *
 * Usage (run on the machine that hosts DATA_DIR, from the repo root):
 *   bun run src/core/scripts/repair-snapshot-tsd-files.ts            # dry run
 *   bun run src/core/scripts/repair-snapshot-tsd-files.ts --execute  # apply
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ForecastSnapshot from "@catalog/models/forecast-snapshot";
import { mysql } from "@database/mysql";

import { getDataDir } from "@/lib/data-dir";

const EXECUTE = process.argv.includes("--execute");
const TSD_DIR = join(getDataDir(), "tsd_files");

const pad = (n: number) => String(n).padStart(2, "0");

/** Hash-input date strings that past buggy code could have produced. */
function candidateDateStrings(created: Date): Record<string, string> {
  const rubyFmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  const shifted = (h: number) => new Date(created.getTime() + h * 3600e3);
  return {
    correct: rubyFmt(created),
    localMinus10: rubyFmt(shifted(-10)), // local accessors on an HST host
    localPlus10: rubyFmt(shifted(10)),
    iso: created.toISOString(),
    isoMinus10: shifted(-10).toISOString(),
  };
}

const disk = readdirSync(TSD_DIR);
const rows = await mysql<Record<string, unknown>>`SELECT * FROM forecast_snapshots`;
const snapshots = rows.map((r) => new ForecastSnapshot(r as never));

// Every disk name that resolves correctly today
const referenced = new Set<string>();
for (const s of snapshots) {
  for (const f of [s.newForecastTsdFilename, s.oldForecastTsdFilename, s.historyTsdFilename]) {
    if (f) referenced.add(s.filePath(f).split("/").pop()!);
  }
}
const orphans = disk.filter((d) => !referenced.has(d));

let planned = 0;
let unresolved = 0;

for (const s of snapshots) {
  const files = [s.newForecastTsdFilename, s.oldForecastTsdFilename, s.historyTsdFilename];
  for (const filename of files) {
    if (!filename) continue;
    const correctPath = s.filePath(filename);
    if (existsSync(correctPath)) continue;

    const correctName = correctPath.split("/").pop()!;
    // Prefer an orphan whose hash matches a known buggy variant for THIS row
    let source: string | null = null;
    let how = "";
    if (s.createdAt) {
      for (const [variant, dateStr] of Object.entries(candidateDateStrings(s.createdAt))) {
        const h = createHash("md5").update(`${dateStr}_${s.id}_${filename}`).digest("hex");
        const hit = orphans.find((o) => o === `${h}_${filename}`);
        if (hit) {
          source = hit;
          how = `hash variant "${variant}"`;
          break;
        }
      }
    }
    // Fall back: an orphan carrying the same original filename (same uploaded
    // content — the suffix IS the original filename)
    if (!source) {
      const suffixMatches = orphans.filter((o) => o.replace(/^[0-9a-f]{32}_/, "") === filename);
      if (suffixMatches.length >= 1) {
        source = suffixMatches[0];
        how = `filename suffix (${suffixMatches.length} candidate${suffixMatches.length > 1 ? "s" : ""})`;
      }
    }

    if (source) {
      planned++;
      console.log(`snapshot ${s.id} (${s.name} ${s.version}) — ${filename}`);
      console.log(`  ${source}  →  ${correctName}  [matched by ${how}]`);
      if (EXECUTE) {
        copyFileSync(join(TSD_DIR, source), correctPath);
        console.log("  copied.");
      }
    } else {
      unresolved++;
      console.log(`snapshot ${s.id} (${s.name} ${s.version}) — ${filename}: NO candidate on disk`);
    }
  }
}

console.log(
  `\n${EXECUTE ? "Applied" : "Dry run —"} ${planned} repair(s), ${unresolved} unresolved.` +
    (EXECUTE ? " Originals left in place (copies, not moves)." : " Re-run with --execute to apply."),
);
process.exit(0);
