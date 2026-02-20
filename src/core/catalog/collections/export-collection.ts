import { mysql } from "@/lib/mysql/db";

import Export from "../models/export";
import type { ExportAttrs } from "../models/export";

export type ExportWithCount = {
  export: Export;
  seriesCount: number;
};

export interface ExportSeriesRow {
  order: number;
  seriesId: number;
  name: string;
  seasonalAdjustment: string | null;
  restricted: boolean;
  dataPortalName: string | null;
  unitShortLabel: string | null;
  unitLongLabel: string | null;
  sourceDescription: string | null;
  minDate: Date | null;
  maxDate: Date | null;
}

interface ExportSeriesQueryRow {
  list_order: number;
  seriesId: number;
  name: string;
  xseriesId: number;
  seasonalAdjustment: string | null;
  restricted: number;
  dataPortalName: string | null;
  unitShortLabel: string | null;
  unitLongLabel: string | null;
  sourceDescription: string | null;
}

interface DateRangeRow {
  id: number;
  min_date: Date | null;
  max_date: Date | null;
}

class ExportCollection {
  static async list(): Promise<ExportWithCount[]> {
    const rows = await mysql<ExportAttrs & { series_count: number }>`
      SELECT e.*, COUNT(es.id) as series_count
      FROM exports e
      LEFT JOIN export_series es ON es.export_id = e.id
      GROUP BY e.id
      ORDER BY e.name
    `;
    return rows.map((row) => ({
      export: new Export(row),
      seriesCount: Number(row.series_count),
    }));
  }

  static async getById(id: number): Promise<Export> {
    const rows = await mysql<ExportAttrs>`
      SELECT * FROM exports WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Export not found: ${id}`);
    return new Export(row);
  }

  static async getSeriesForExport(exportId: number): Promise<ExportSeriesRow[]> {
    const mainRows = await mysql<ExportSeriesQueryRow>`
      SELECT
        es.list_order,
        s.id as seriesId,
        s.name as name,
        xs.seasonal_adjustment as seasonalAdjustment,
        xs.restricted as restricted,
        s.dataPortalName as dataPortalName,
        s.xseries_id as xseriesId,
        u.short_label as unitShortLabel,
        u.long_label as unitLongLabel,
        src.description as sourceDescription
      FROM export_series es
      INNER JOIN series s ON s.id = es.series_id
      INNER JOIN xseries xs ON xs.id = s.xseries_id
      LEFT JOIN units u ON u.id = s.unit_id
      LEFT JOIN sources src ON src.id = s.source_id
      WHERE es.export_id = ${exportId}
      ORDER BY es.list_order
    `;

    const xseriesIds = mainRows.map((row) => row.xseriesId);

    let dateMap = new Map<number, DateRangeRow>();
    if (xseriesIds.length > 0) {
      const dateRows = await mysql<DateRangeRow>`
        SELECT
          xseries_id as id,
          MIN(date) as min_date,
          MAX(date) as max_date
        FROM data_points
        WHERE xseries_id IN ${mysql(xseriesIds)}
        GROUP BY xseries_id
      `;
      dateMap = new Map(dateRows.map((row) => [row.id, row]));
    }

    return mainRows.map((row) => {
      const dateInfo = dateMap.get(row.xseriesId);
      return {
        order: row.list_order + 1,
        seriesId: row.seriesId,
        name: row.name,
        seasonalAdjustment: row.seasonalAdjustment,
        restricted: Boolean(row.restricted),
        dataPortalName: row.dataPortalName,
        unitShortLabel: row.unitShortLabel,
        unitLongLabel: row.unitLongLabel,
        sourceDescription: row.sourceDescription,
        minDate: dateInfo?.min_date || null,
        maxDate: dateInfo?.max_date || null,
      };
    });
  }

  static async create(name: string): Promise<Export> {
    const rows = await mysql<ExportAttrs>`
      INSERT INTO exports (name) VALUES (${name})
      RETURNING *
    `;
    return new Export(rows[0]);
  }

  static async update(id: number, payload: { name?: string }): Promise<Export> {
    if (payload.name !== undefined) {
      await mysql`UPDATE exports SET name = ${payload.name} WHERE id = ${id}`;
    }
    return this.getById(id);
  }

  static async addSeries(exportId: number, seriesId: number): Promise<void> {
    const maxRows = await mysql<{ max_order: number | null }>`
      SELECT MAX(list_order) as max_order FROM export_series WHERE export_id = ${exportId}
    `;
    const nextOrder = (maxRows[0]?.max_order ?? -1) + 1;
    await mysql`
      INSERT INTO export_series (export_id, series_id, list_order)
      VALUES (${exportId}, ${seriesId}, ${nextOrder})
    `;
  }

  static async removeSeries(exportId: number, seriesId: number): Promise<void> {
    await mysql`
      DELETE FROM export_series
      WHERE export_id = ${exportId} AND series_id = ${seriesId}
    `;
    // Re-number remaining rows sequentially
    const remaining = await mysql<{ id: number }>`
      SELECT id FROM export_series
      WHERE export_id = ${exportId}
      ORDER BY list_order
    `;
    for (let i = 0; i < remaining.length; i++) {
      await mysql`
        UPDATE export_series SET list_order = ${i} WHERE id = ${remaining[i].id}
      `;
    }
  }

  static async moveSeries(
    exportId: number,
    seriesId: number,
    direction: "up" | "down",
  ): Promise<void> {
    // Get current row
    const currentRows = await mysql<{ id: number; list_order: number }>`
      SELECT id, list_order FROM export_series
      WHERE export_id = ${exportId} AND series_id = ${seriesId}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) return;

    // Find neighbor to swap with
    const neighborRows =
      direction === "up"
        ? await mysql<{ id: number; list_order: number }>`
            SELECT id, list_order FROM export_series
            WHERE export_id = ${exportId} AND list_order < ${current.list_order}
            ORDER BY list_order DESC LIMIT 1
          `
        : await mysql<{ id: number; list_order: number }>`
            SELECT id, list_order FROM export_series
            WHERE export_id = ${exportId} AND list_order > ${current.list_order}
            ORDER BY list_order ASC LIMIT 1
          `;
    const neighbor = neighborRows[0];
    if (!neighbor) return;

    // Swap list_order values
    await mysql`UPDATE export_series SET list_order = ${neighbor.list_order} WHERE id = ${current.id}`;
    await mysql`UPDATE export_series SET list_order = ${current.list_order} WHERE id = ${neighbor.id}`;
  }

  static async replaceAllSeries(
    exportId: number,
    seriesNames: string[],
  ): Promise<{ added: number; notFound: string[] }> {
    // Look up series IDs by name
    const notFound: string[] = [];
    const seriesIds: number[] = [];

    for (const name of seriesNames) {
      const rows = await mysql<{ id: number }>`
        SELECT id FROM series WHERE name = ${name} LIMIT 1
      `;
      if (rows[0]) {
        seriesIds.push(rows[0].id);
      } else {
        notFound.push(name);
      }
    }

    // Delete all existing
    await mysql`DELETE FROM export_series WHERE export_id = ${exportId}`;

    // Insert new ones in order
    for (let i = 0; i < seriesIds.length; i++) {
      await mysql`
        INSERT INTO export_series (export_id, series_id, list_order)
        VALUES (${exportId}, ${seriesIds[i]}, ${i})
      `;
    }

    return { added: seriesIds.length, notFound };
  }

  static async getSeriesNames(exportId: number): Promise<string[]> {
    const rows = await mysql<{ name: string }>`
      SELECT s.name
      FROM export_series es
      INNER JOIN series s ON s.id = es.series_id
      WHERE es.export_id = ${exportId}
      ORDER BY es.list_order
    `;
    return rows.map((r) => r.name);
  }

  static async getSeriesIdsForExport(
    exportId: number,
  ): Promise<{ xseriesId: number; name: string }[]> {
    const rows = await mysql<{ xseries_id: number; name: string }>`
      SELECT s.xseries_id, s.name
      FROM export_series es
      INNER JOIN series s ON s.id = es.series_id
      WHERE es.export_id = ${exportId}
      ORDER BY es.list_order
    `;
    return rows.map((r) => ({ xseriesId: r.xseries_id, name: r.name }));
  }

  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM export_series WHERE export_id = ${id}`;
    await mysql`DELETE FROM exports WHERE id = ${id}`;
  }
}

export default ExportCollection;
