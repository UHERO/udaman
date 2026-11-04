/**
 * Switch the TOUR_CYFENG file loaders from .xls to .xlsx.
 *
 * Targets the same loaders as the search `#tour_cyfeng` (enabled loaders whose
 * eval matches /tour_cyfeng/i) and rewrites, e.g.
 *
 *   Series.load_from_file("rawdata/TOUR_CYFENG%y.xls", {:file_type=>"xls", ...})
 * to
 *   Series.load_from_file("rawdata/TOUR_CYFENG%y.xlsx", {:file_type=>"xlsx", ...})
 *
 * Only the file path extension and the :file_type option are touched; every
 * other option is left as-is. Loaders already on xlsx are reported and skipped.
 *
 * Usage:
 *   bun run scripts/tour-cyfeng-xls-to-xlsx.ts --dry-run
 *   bun run scripts/tour-cyfeng-xls-to-xlsx.ts
 *   bun run scripts/tour-cyfeng-xls-to-xlsx.ts --include-disabled
 */
import LoaderCollection from "@catalog/collections/loader-collection";
import { mysql } from "@database/mysql/helpers";

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_DISABLED = process.argv.includes("--include-disabled");

type Row = { id: number; series_name: string | null; eval: string };

/** "...TOUR_CYFENG%y.xls" → ".xlsx" (only when followed by the closing quote). */
const PATH_RE = /(TOUR_CYFENG[^"']*?)\.xls(["'])/gi;
/** :file_type=>"xls" (also tolerates `file_type: "xls"` and spacing). */
const TYPE_RE = /(:file_type\s*=>\s*|file_type:\s*)(["'])xls\2/g;

function rewrite(evalStr: string): string {
  return evalStr.replace(PATH_RE, "$1.xlsx$2").replace(TYPE_RE, "$1$2xlsx$2");
}

async function main() {
  const rows = INCLUDE_DISABLED
    ? await mysql<Row>`
        SELECT ds.id, s.name AS series_name, ds.eval
        FROM data_sources ds
        LEFT JOIN series s ON s.id = ds.series_id
        WHERE ds.eval REGEXP 'tour_cyfeng'
        ORDER BY s.name, ds.id`
    : await mysql<Row>`
        SELECT ds.id, s.name AS series_name, ds.eval
        FROM data_sources ds
        LEFT JOIN series s ON s.id = ds.series_id
        WHERE ds.eval REGEXP 'tour_cyfeng' AND NOT(ds.disabled)
        ORDER BY s.name, ds.id`;

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}${rows.length} loader(s) matching #tour_cyfeng` +
      `${INCLUDE_DISABLED ? " (incl. disabled)" : ""}\n`,
  );

  let updated = 0;
  let unchanged = 0;
  let partial = 0;
  let failed = 0;

  for (const row of rows) {
    const label = `${row.series_name ?? "?"} (loader ${row.id})`;
    const next = rewrite(row.eval);

    if (next === row.eval) {
      unchanged++;
      console.log(`  SKIP     ${label}: nothing to change`);
      continue;
    }

    // Both edits should land together; flag loaders where only one did so a
    // path/file_type mismatch doesn't slip through silently.
    const pathOk = /TOUR_CYFENG[^"']*\.xlsx["']/i.test(next);
    const typeOk = /file_type\s*(=>|:)\s*["']xlsx["']/.test(next);
    if (!pathOk || !typeOk) {
      partial++;
      console.log(
        `  PARTIAL  ${label}: path=${pathOk ? "xlsx" : "NOT xlsx"} file_type=${typeOk ? "xlsx" : "NOT xlsx"}`,
      );
    }

    console.log(`  - ${row.eval}\n  + ${next}`);

    if (DRY_RUN) {
      updated++;
      continue;
    }
    try {
      await LoaderCollection.update(row.id, { eval: next });
      updated++;
    } catch (e) {
      failed++;
      console.error(
        `  ERROR    ${label}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would update" : "Updated"}: ${updated}` +
      `\nUnchanged: ${unchanged}` +
      (partial ? `\nPartial rewrites (check above): ${partial}` : "") +
      (failed ? `\nErrors: ${failed}` : ""),
  );
}

await main();
process.exit(0);
