import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";
import { mysql, rawQuery } from "@/lib/mysql/db";

const log = createLogger("catalog.kauai-export");

/** Map of Export name → [data filename, optional export filename] */
const KAUAI_EXPORTS: Record<string, string[]> = {
  "Kauai Dashboard Major Indicators Data - A": [
    "major_a.csv",
    "major_a_export.csv",
  ],
  "Kauai Dashboard Major Indicators Data - Q": ["major_q.csv"],
  "Kauai Dashboard Major Indicators Data - M": ["major_m.csv"],
  "Kauai Dashboard Visitor Data - A": ["vis_a.csv", "vis_a_export.csv"],
  "Kauai Dashboard Visitor Data - Q": ["vis_q.csv", "vis_q_export.csv"],
  "Kauai Dashboard Visitor Data - M": ["vis_m.csv", "vis_m_export.csv"],
  "Kauai Dashboard Jobs Seasonally Adjusted Data - A": [
    "jobs_a.csv",
    "jobs_a_export.csv",
  ],
  "Kauai Dashboard Jobs Seasonally Adjusted Data - Q": [
    "jobs_q.csv",
    "jobs_q_export.csv",
  ],
  "Kauai Dashboard Jobs Seasonally Adjusted Data - M": [
    "jobs_m.csv",
    "jobs_m_export.csv",
  ],
  "Kauai Dashboard Income Data - A": ["income_a.csv", "income_a_export.csv"],
  "Kauai Dashboard Construction Data - A": [
    "const_a.csv",
    "const_a_export.csv",
  ],
  "Kauai Dashboard Construction Data - Q": [
    "const_q.csv",
    "const_q_export.csv",
  ],
  "Kauai Dashboard Budget Data - A": [
    "county_rev_a.csv",
    "county_rev_a_export.csv",
  ],
};

/** Empty placeholder files that must exist for the dashboard */
const EMPTY_FILES = [
  "const_m.csv",
  "county_rev_m.csv",
  "county_rev_q.csv",
  "income_m.csv",
  "income_q.csv",
];

interface ExportRow {
  id: number;
  name: string;
}

interface ExportSeriesRow {
  series_id: number;
  name: string;
  dataPortalName: string | null;
}

interface DataPointRow {
  date: Date | string;
  value: number | null;
  series_name: string;
}

function formatDate(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

function formatValue(v: number | null): string {
  if (v == null) return "";
  return v.toFixed(2);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Run the Kauai Dashboard export.
 * Ports the Rails `export_kauai_dashboard` rake task.
 */
export async function runKauaiExport(): Promise<void> {
  log.info("Starting Kauai dashboard export");

  const dataDir = getDataDir();
  const dataPath = join(dataDir, "kauai_dash", "data");
  const exportPath = join(dataDir, "kauai_dash", "export_data");

  await mkdir(dataPath, { recursive: true });
  await mkdir(exportPath, { recursive: true });

  for (const [exportName, filenames] of Object.entries(KAUAI_EXPORTS)) {
    log.info({ exportName }, "Processing export");

    // Find the Export record
    const exportRows = await mysql<ExportRow>`
      SELECT id, name FROM exports WHERE name = ${exportName} LIMIT 1
    `;
    if (!exportRows[0]) {
      log.warn({ exportName }, "Export not found, skipping");
      continue;
    }
    const exportId = exportRows[0].id;

    // Get ordered series for this export
    const seriesRows = await rawQuery<ExportSeriesRow>(
      `SELECT s.id AS series_id, s.name, s.dataPortalName
       FROM export_series es
       JOIN series s ON s.id = es.series_id
       WHERE es.export_id = ?
       ORDER BY es.list_order`,
      [exportId],
    );

    if (seriesRows.length === 0) {
      log.warn({ exportName }, "No series in export, skipping");
      continue;
    }

    const names = seriesRows.map((r) => r.name);
    const titles = seriesRows.map((r) => r.dataPortalName ?? r.name);

    // Get current data points for all series in this export
    const seriesIds = seriesRows.map((r) => r.series_id);
    const placeholders = seriesIds.map(() => "?").join(",");
    const dataRows = await rawQuery<DataPointRow>(
      `SELECT dp.date, dp.value, s.name AS series_name
       FROM data_points dp
       JOIN series s ON s.xseries_id = dp.xseries_id
       WHERE s.id IN (${placeholders})
         AND dp.current = 1
       ORDER BY dp.date`,
      seriesIds,
    );

    // Build data map: seriesName → { date → value }
    const dataMap = new Map<string, Map<string, number | null>>();
    for (const name of names) {
      dataMap.set(name, new Map());
    }
    const allDatesSet = new Set<string>();
    for (const row of dataRows) {
      const dateStr = formatDate(row.date);
      allDatesSet.add(dateStr);
      const seriesData = dataMap.get(row.series_name);
      if (seriesData) {
        seriesData.set(dateStr, row.value);
      }
    }
    const allDates = Array.from(allDatesSet).sort();

    // Write internal data file (series names as headers)
    const dataFilename = filenames[0];
    const dataLines: string[] = [];
    dataLines.push(["date", ...names.map(escapeCsv)].join(","));
    for (const date of allDates) {
      const values = names.map((name) => {
        const v = dataMap.get(name)?.get(date) ?? null;
        return formatValue(v);
      });
      dataLines.push([date, ...values].join(","));
    }
    await writeFile(join(dataPath, dataFilename), dataLines.join("\n") + "\n");

    // Write export data file (portal names as headers), if specified
    const exportFilename = filenames[1];
    if (exportFilename) {
      const exportLines: string[] = [];
      exportLines.push(["date", ...titles.map(escapeCsv)].join(","));
      for (const date of allDates) {
        const values = names.map((name) => {
          const v = dataMap.get(name)?.get(date) ?? null;
          return formatValue(v);
        });
        exportLines.push([date, ...values].join(","));
      }
      await writeFile(
        join(exportPath, exportFilename),
        exportLines.join("\n") + "\n",
      );
    }
  }

  // Create empty placeholder files
  for (const emptyFile of EMPTY_FILES) {
    await writeFile(join(dataPath, emptyFile), "");
  }

  log.info("Kauai dashboard export complete");
}
