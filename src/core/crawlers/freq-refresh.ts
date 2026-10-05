import { freqInsertStatements } from "@/core/catalog/utils/hhdb-freq-sql";
import { isMissingTableError } from "@/core/catalog/utils/hhdb-missing-table";
import { createLogger } from "@/core/observability/logger";

import type { Db } from "./address";

const log = createLogger("freq-refresh");

export type Tx = (fn: (query: Db) => Promise<void>) => Promise<void>;

export interface FreqTarget {
  table: string;
  /** Columns counted by year. */
  dateColumns: ReadonlySet<string>;
}

/**
 * Rebuild `freq_<table>` for each target right after a load, so the Summary
 * and Exploration tabs never show the previous load's counts. One transaction
 * per table: readers see the old counts until it commits.
 *
 * DELETE, not TRUNCATE: the app user has DML rights only. A freq table whose
 * migration has not been applied yet is skipped with a warning, not an error.
 */
export async function refreshFreqTables(
  db: Db,
  tx: Tx,
  targets: readonly FreqTarget[],
): Promise<Record<string, "refreshed" | "missing">> {
  const out: Record<string, "refreshed" | "missing"> = {};
  for (const { table, dateColumns } of targets) {
    const freq = `freq_${table}`;
    try {
      await db(`SELECT 1 FROM ${freq} LIMIT 0`);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      log.warn(
        { freq },
        "freq table missing; apply its migration, then reload",
      );
      out[table] = "missing";
      continue;
    }
    const start = performance.now();
    await tx(async (query) => {
      await query(`DELETE FROM ${freq}`);
      for (const sql of freqInsertStatements(table, dateColumns))
        await query(sql);
    });
    log.info(
      { freq, ms: Math.round(performance.now() - start) },
      "freq refreshed",
    );
    out[table] = "refreshed";
  }
  return out;
}
