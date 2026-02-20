import { mysql, rawQuery } from "@/lib/mysql/db";
import { buildUpdateObject, convertCommas } from "@/lib/mysql/helpers";

import Series from "../models/series";
import type { SeriesAttrs } from "../models/series";
import type {
  SeasonalAdjustment,
  SeriesAuditRow,
  SeriesMetadata,
  Universe,
} from "../types/shared";
import type { SeriesSummary } from "../types/udaman";
import { isValidUniverse } from "../utils/validators";
import TimeSeriesCollection from "./time-series-collection";

/** Row shape returned by the summary SELECT (before date enrichment). */
interface SeriesSummaryRow {
  name: string;
  id: number;
  xseriesId: number;
  seasonalAdjustment: SeasonalAdjustment;
  restricted: number;
  portalName: string | null;
  unitShortLabel: string | null;
  sourceDescription: string | null;
  sourceUrl: string | null;
}

/** Row shape returned by the date-range aggregation query. */
interface DateRangeRow {
  id: number;
  min_date: Date | null;
  max_date: Date | null;
}

// ─── Payload types ───────────────────────────────────────────────────

export type CreateSeriesPayload = {
  name: string;
  universe?: Universe;
  geographyId?: number | null;
  dataPortalName?: string | null;
  description?: string | null;
  decimals?: number;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  sourceLink?: string | null;
  investigationNotes?: string | null;
  // TimeSeries fields (passed through to xseries)
  frequency?: string | null;
  seasonalAdjustment?: SeasonalAdjustment | null;
  seasonallyAdjusted?: boolean | null;
  restricted?: boolean;
  quarantined?: boolean;
  percent?: boolean | null;
  real?: boolean | null;
  baseYear?: number | null;
  frequencyTransform?: string | null;
  factorApplication?: string | null;
  factors?: string | null;
  aremosMissing?: number | null;
  aremosDiff?: number | null;
  mult?: number | null;
};

export type UpdateSeriesPayload = {
  name?: string;
  dataPortalName?: string | null;
  description?: string | null;
  decimals?: number;
  geographyId?: number | null;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  sourceLink?: string | null;
  investigationNotes?: string | null;
  scratch?: number;
  // TimeSeries fields (only applied if this series is primary)
  frequency?: string | null;
  seasonalAdjustment?: SeasonalAdjustment | null;
  seasonallyAdjusted?: boolean | null;
  restricted?: boolean;
  quarantined?: boolean;
  percent?: boolean | null;
  real?: boolean | null;
  baseYear?: number | null;
  frequencyTransform?: string | null;
  factorApplication?: string | null;
  factors?: string | null;
  aremosMissing?: number | null;
  aremosDiff?: number | null;
  mult?: number | null;
};

// ─── Collection ──────────────────────────────────────────────────────

class SeriesCollection {
  /**
   * Create a new series and its backing TimeSeries (xseries) record.
   *
   * Flow:
   *  1. Parse the name to extract geo handle and frequency
   *  2. Resolve geography_id from handle + universe
   *  3. Apply metadata integrity rules (SA, percent)
   *  4. Create the xseries record
   *  5. Insert the series row pointing to that xseries
   *  6. Set xseries.primary_series_id back to the new series
   */
  static async create(payload: CreateSeriesPayload): Promise<Series> {
    const universe = payload.universe ?? "UHERO";
    const parsed = Series.parseName(payload.name);

    // Resolve geography
    let geoId = payload.geographyId ?? null;
    if (!geoId) {
      const geoRows = await mysql<{ id: number }>`
        SELECT id FROM geographies
        WHERE universe = ${universe} AND handle = ${parsed.geo}
        LIMIT 1
      `;
      if (!geoRows[0]) {
        throw new Error(
          `No ${universe} geography found for handle=${parsed.geo}`,
        );
      }
      geoId = geoRows[0].id;
    }

    // Derive frequency from name if not provided
    const frequency = payload.frequency ?? parsed.freqLong ?? null;

    // Meta integrity: annual → not_applicable; NS suffix → not_seasonally_adjusted
    let sa = payload.seasonalAdjustment ?? null;
    if (frequency === "year") {
      sa = "not_applicable";
    } else if (/NS$/i.test(parsed.prefix)) {
      sa = "not_seasonally_adjusted";
    }

    // Resolve percent from unit if provided
    let percent = payload.percent ?? null;
    if (payload.unitId) {
      const unitRows = await mysql<{ short_label: string | null }>`
        SELECT short_label FROM units WHERE id = ${payload.unitId} LIMIT 1
      `;
      if (unitRows[0]) {
        percent = unitRows[0].short_label === "%";
      }
    }

    // 1. Create xseries
    const timeSeries = await TimeSeriesCollection.create({
      frequency,
      seasonalAdjustment: sa,
      seasonallyAdjusted: payload.seasonallyAdjusted,
      restricted: payload.restricted,
      quarantined: payload.quarantined,
      percent,
      real: payload.real,
      baseYear: payload.baseYear,
      frequencyTransform: payload.frequencyTransform,
      factorApplication: payload.factorApplication,
      factors: payload.factors,
      aremosMissing: payload.aremosMissing,
      aremosDiff: payload.aremosDiff,
      mult: payload.mult,
    });

    // 2. Insert series row
    await mysql`
      INSERT INTO series (
        xseries_id, name, universe, geography_id, unit_id, source_id,
        source_detail_id, dataPortalName, description, decimals,
        source_link, investigation_notes, dependency_depth, scratch,
        created_at, updated_at
      ) VALUES (
        ${timeSeries.id},
        ${payload.name},
        ${universe},
        ${geoId},
        ${payload.unitId ?? null},
        ${payload.sourceId ?? null},
        ${payload.sourceDetailId ?? null},
        ${payload.dataPortalName ?? null},
        ${payload.description ?? null},
        ${payload.decimals ?? 1},
        ${payload.sourceLink ?? null},
        ${payload.investigationNotes ?? null},
        ${0},
        ${0},
        NOW(),
        NOW()
      )
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;

    // 3. Set primary_series_id back on xseries
    await TimeSeriesCollection.setPrimarySeries(timeSeries.id, insertId);

    return this.getById(insertId);
  }

  /** Fetch a single series by name, returned as a Series model instance */
  static async getByName(seriesName: string): Promise<Series> {
    const rows = await mysql<SeriesAttrs>`
      SELECT
        s.id, s.xseries_id, s.geography_id, s.unit_id, s.source_id,
        s.source_detail_id, s.universe, s.decimals, s.name, s.dataPortalName,
        s.description, s.created_at, s.updated_at, s.dependency_depth,
        s.source_link, s.investigation_notes, s.scratch,
        x.primary_series_id, x.frequency, x.restricted, x.quarantined,
        x.seasonal_adjustment, x.seasonally_adjusted, x.aremos_missing,
        x.aremos_diff, x.percent, x.real,
        u.short_label as unit_short_label,
        u.long_label as unit_long_label
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      LEFT JOIN units u ON s.unit_id = u.id
      WHERE s.name = ${seriesName}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Series not found: ${seriesName}`);
    return new Series(row);
  }

  /**
   * Bulk-lookup display names and IDs for a list of series names (e.g. "N@US", "LFP@US").
   * First tries exact name match, then falls back to prefix-based UHERO lookup.
   * Returns a map of series name → { displayName, id }.
   */
  static async lookupSeriesInfo(
    names: string[],
  ): Promise<Map<string, { displayName: string; id: number }>> {
    const result = new Map<string, { displayName: string; id: number }>();
    if (!names.length) return result;

    // Exact name match
    const placeholders = names.map(() => "?").join(",");
    const rows = await rawQuery<{
      id: number;
      name: string;
      dataPortalName: string | null;
    }>(
      `SELECT id, name, dataPortalName FROM series
       WHERE name IN (${placeholders}) AND dataPortalName IS NOT NULL`,
      names,
    );
    for (const row of rows) {
      if (row.dataPortalName) {
        result.set(row.name, { displayName: row.dataPortalName, id: row.id });
      }
    }

    // For names not found, try prefix-based lookup in UHERO universe
    const missing = names.filter((n) => !result.has(n));
    for (const name of missing) {
      const atIdx = name.indexOf("@");
      if (atIdx < 0) continue;
      const prefix = name.substring(0, atIdx);
      const prefixRows = await mysql<{
        id: number;
        dataPortalName: string | null;
      }>`
        SELECT id, dataPortalName FROM series
        WHERE universe = 'UHERO' AND name LIKE ${prefix + "@%"}
          AND dataPortalName IS NOT NULL
        LIMIT 1
      `;
      if (prefixRows[0]?.dataPortalName) {
        result.set(name, {
          displayName: prefixRows[0].dataPortalName,
          id: prefixRows[0].id,
        });
      }
    }

    return result;
  }

  /** Fetch a single series by name and universe, returning null if not found. */
  static async findByNameAndUniverse(
    name: string,
    universe: Universe,
  ): Promise<Series | null> {
    const rows = await mysql<SeriesAttrs>`
      SELECT
        s.id, s.xseries_id, s.geography_id, s.unit_id, s.source_id,
        s.source_detail_id, s.universe, s.decimals, s.name, s.dataPortalName,
        s.description, s.created_at, s.updated_at, s.dependency_depth,
        s.source_link, s.investigation_notes, s.scratch,
        x.primary_series_id, x.frequency, x.restricted, x.quarantined,
        x.seasonal_adjustment, x.seasonally_adjusted, x.aremos_missing,
        x.aremos_diff, x.percent, x.real,
        u.short_label as unit_short_label,
        u.long_label as unit_long_label
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      LEFT JOIN units u ON s.unit_id = u.id
      WHERE s.name = ${name} AND s.universe = ${universe}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return new Series(row);
  }

  /** Load current data points from the database into a Series' in-memory data map. */
  static async loadCurrentData(series: Series): Promise<void> {
    if (!series.xseriesId) return;
    const rows = await mysql<{ date: Date | string; value: number | null }>`
      SELECT date, value
      FROM data_points
      WHERE xseries_id = ${series.xseriesId} AND current = 1
      ORDER BY date
    `;
    const data = new Map<string, number>();
    for (const row of rows) {
      if (row.value == null) continue;
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date);
      data.set(dateStr, row.value);
    }
    series.data = data;
  }

  /** Fetch a single series by id, returned as a Series model instance */
  static async getById(id: number): Promise<Series> {
    const rows = await mysql<SeriesAttrs>`
      SELECT
        s.id, s.xseries_id, s.geography_id, s.unit_id, s.source_id,
        s.source_detail_id, s.universe, s.decimals, s.name, s.dataPortalName,
        s.description, s.created_at, s.updated_at, s.dependency_depth,
        s.source_link, s.investigation_notes, s.scratch,
        x.primary_series_id, x.frequency, x.restricted, x.quarantined,
        x.seasonal_adjustment, x.seasonally_adjusted, x.aremos_missing,
        x.aremos_diff, x.percent, x.real,
        u.short_label as unit_short_label,
        u.long_label as unit_long_label
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      LEFT JOIN units u ON s.unit_id = u.id
      WHERE s.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Series not found: ${id}`);
    return new Series(row);
  }

  /** Fetch the denormalized metadata view for a series (joined with geo, unit, source, etc.) */
  static async getSeriesMetadata({
    id,
  }: {
    id: number;
  }): Promise<SeriesMetadata> {
    const rows = await mysql<SeriesMetadata>`
      SELECT
        s.id as s_id,
        s.geography_id as s_geography_id,
        s.unit_id as s_unit_id,
        s.source_id as s_source_id,
        s.source_detail_id as s_source_detail_id,
        s.universe as s_universe,
        s.decimals as s_decimals,
        s.name as s_name,
        s.dataPortalName as s_dataPortalName,
        s.description as s_description,
        s.created_at as s_created_at,
        s.updated_at as s_updated_at,
        s.dependency_depth as s_dependency_depth,
        s.source_link as s_source_link,
        s.investigation_notes as s_investigation_notes,
        s.scratch as s_scratch,
        x.id as xs_id,
        x.primary_series_id as xs_primary_series_id,
        x.restricted as xs_restricted,
        x.quarantined as xs_quarantined,
        x.frequency as xs_frequency,
        x.seasonally_adjusted as xs_seasonally_adjusted,
        x.seasonal_adjustment as xs_seasonal_adjustment,
        x.aremos_missing as xs_aremos_missing,
        x.aremos_diff as xs_aremos_diff,
        x.mult as xs_mult,
        x.created_at as xs_created_at,
        x.updated_at as xs_updated_at,
        x.units as xs_units,
        x.percent as xs_percent,
        x.real as xs_real,
        x.base_year as xs_base_year,
        x.frequency_transform as xs_frequency_transform,
        x.last_demetra_date as xs_last_demetra_date,
        x.last_demetra_datestring as xs_last_demetra_datestring,
        x.factor_application as xs_factor_application,
        x.factors as xs_factors,
        g.handle as geo_handle,
        g.display_name as geo_display_name,
        u.short_label as u_short_label,
        u.long_label as u_long_label,
        src.description as source_description,
        src.link as source_link,
        sd.description as source_detail_description
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      LEFT JOIN geographies g ON s.geography_id = g.id
      LEFT JOIN units u ON s.unit_id = u.id
      LEFT JOIN sources src ON s.source_id = src.id
      LEFT JOIN source_details sd ON s.source_detail_id = sd.id
      WHERE s.id = ${id}
    `;
    if (rows.length === 0) throw new Error("404 - Series not found: " + id);
    return rows[0];
  }

  /** Fetch the most recent 40 series for the homepage summary list */
  static async getSummaryList({
    offset,
    limit,
    universe,
  }: {
    offset?: number;
    limit?: number;
    universe: Universe;
  }) {
    const mainRows = await mysql<SeriesSummaryRow>`
      SELECT
        s.name as name,
        s.id as id,
        s.xseries_id as xseriesId,
        xs.seasonal_adjustment as seasonalAdjustment,
        xs.restricted as restricted,
        s.dataPortalName as portalName,
        u.short_label as unitShortLabel,
        src.description as sourceDescription,
        src.link as sourceUrl
      FROM series s
      INNER JOIN xseries xs ON xs.id = s.xseries_id
      LEFT JOIN units u ON u.id = s.unit_id
      LEFT JOIN sources src ON src.id = s.source_id
      WHERE s.universe = ${universe}
      ORDER BY s.created_at DESC
      LIMIT 40
    `;

    const xseriesIds = mainRows.map((row) => row.xseriesId);

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

      const dateMap = new Map(dateRows.map((row) => [row.id, row]));

      const finalRows: SeriesSummary[] = mainRows.map((row) => {
        const dateInfo = dateMap.get(row.xseriesId);
        return {
          name: row.name,
          id: row.id,
          seasonalAdjustment: row.seasonalAdjustment,
          restricted: Boolean(row.restricted),
          portalName: row.portalName,
          unitShortLabel: row.unitShortLabel,
          sourceDescription: row.sourceDescription,
          sourceUrl: row.sourceUrl,
          minDate: dateInfo?.min_date || null,
          maxDate: dateInfo?.max_date || null,
        };
      });

      return finalRows;
    }
    return mainRows.map((row) => ({
      name: row.name,
      id: row.id,
      seasonalAdjustment: row.seasonalAdjustment,
      restricted: Boolean(row.restricted),
      portalName: row.portalName,
      unitShortLabel: row.unitShortLabel,
      sourceDescription: row.sourceDescription,
      sourceUrl: row.sourceUrl,
      minDate: null,
      maxDate: null,
    }));
  }

  /** Fetch summary data for a specific set of series IDs (used to hydrate search results) */
  static async getSummaryByIds(ids: number[]): Promise<SeriesSummary[]> {
    if (ids.length === 0) return [];

    const mainRows = await mysql<SeriesSummaryRow>`
      SELECT
        s.name as name,
        s.id as id,
        s.xseries_id as xseriesId,
        xs.seasonal_adjustment as seasonalAdjustment,
        xs.restricted as restricted,
        s.dataPortalName as portalName,
        u.short_label as unitShortLabel,
        src.description as sourceDescription,
        src.link as sourceUrl
      FROM series s
      INNER JOIN xseries xs ON xs.id = s.xseries_id
      LEFT JOIN units u ON u.id = s.unit_id
      LEFT JOIN sources src ON src.id = s.source_id
      WHERE s.id IN ${mysql(ids)}
      ORDER BY s.name
    `;

    const xseriesIds = mainRows.map((row) => row.xseriesId);

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

      const dateMap = new Map(dateRows.map((row) => [row.id, row]));

      return mainRows.map((row) => {
        const dateInfo = dateMap.get(row.xseriesId);
        return {
          name: row.name,
          id: row.id,
          seasonalAdjustment: row.seasonalAdjustment,
          restricted: Boolean(row.restricted),
          portalName: row.portalName,
          unitShortLabel: row.unitShortLabel,
          sourceDescription: row.sourceDescription,
          sourceUrl: row.sourceUrl,
          minDate: dateInfo?.min_date || null,
          maxDate: dateInfo?.max_date || null,
        };
      });
    }

    return mainRows.map((row) => ({
      name: row.name,
      id: row.id,
      seasonalAdjustment: row.seasonalAdjustment,
      restricted: Boolean(row.restricted),
      portalName: row.portalName,
      unitShortLabel: row.unitShortLabel,
      sourceDescription: row.sourceDescription,
      sourceUrl: row.sourceUrl,
      minDate: null,
      maxDate: null,
    }));
  }

  /**
   * Update a series (and its xseries if it's the primary).
   *
   * Series-table fields are always written. TimeSeries-table fields
   * (frequency, SA, percent, etc.) are only written when this series
   * is the primary — aliases don't own the shared data metadata.
   */
  static async update(
    id: number,
    payload: UpdateSeriesPayload,
  ): Promise<Series> {
    if (!Object.keys(payload).length) return this.getById(id);

    const series = await this.getById(id);

    // Separate series vs xseries fields
    const {
      frequency,
      seasonalAdjustment,
      seasonallyAdjusted,
      restricted,
      quarantined,
      percent,
      real,
      baseYear,
      frequencyTransform,
      factorApplication,
      factors,
      aremosMissing,
      aremosDiff,
      mult,
      ...seriesFields
    } = payload;

    const xseriesPayload = {
      frequency,
      seasonalAdjustment,
      seasonallyAdjusted,
      restricted,
      quarantined,
      percent,
      real,
      baseYear,
      frequencyTransform,
      factorApplication,
      factors,
      aremosMissing,
      aremosDiff,
      mult,
    };

    // Apply meta integrity rules
    const effFreq = frequency ?? series.frequency;
    if (effFreq === "year") {
      xseriesPayload.seasonalAdjustment = "not_applicable";
    } else {
      const effName = seriesFields.name ?? series.name;
      if (/NS$/i.test(Series.parseName(effName).prefix)) {
        xseriesPayload.seasonalAdjustment = "not_seasonally_adjusted";
      }
    }

    // Resolve percent from unit if unit is changing
    if (seriesFields.unitId !== undefined) {
      const unitId = seriesFields.unitId;
      if (unitId) {
        const unitRows = await mysql<{ short_label: string | null }>`
          SELECT short_label FROM units WHERE id = ${unitId} LIMIT 1
        `;
        if (unitRows[0]) {
          xseriesPayload.percent = unitRows[0].short_label === "%";
        }
      }
    }

    // Update series table fields
    const seriesUpdateObj = buildUpdateObject(seriesFields, {
      dataPortalName: "dataPortalName",
    });
    const seriesCols = Object.keys(seriesUpdateObj);
    if (seriesCols.length > 0) {
      await mysql`
        UPDATE series
        SET ${mysql(seriesUpdateObj, ...seriesCols)}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Update xseries fields only if this is the primary series
    if (series.isPrimary) {
      // Strip undefined values
      const cleanXs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(xseriesPayload)) {
        if (v !== undefined) cleanXs[k] = v;
      }
      if (Object.keys(cleanXs).length > 0) {
        await TimeSeriesCollection.update(
          series.xseriesId!,
          cleanXs as Parameters<typeof TimeSeriesCollection.update>[1],
        );
      }
    }

    return this.getById(id);
  }

  /**
   * Delete a series.
   *
   * Guards:
   *  - Cannot delete a primary series that still has aliases
   *  - Cannot delete a series that other series depend on (via loader deps)
   *
   * Cleanup:
   *  - Deletes public_data_points for this series
   *  - If primary: clears primary_series_id FK, deletes series, then deletes
   *    the xseries (which cascades to data_points)
   *  - If alias: just deletes the series row
   */
  static async delete(id: number, opts?: { force?: boolean }): Promise<void> {
    const series = await this.getById(id);

    if (series.isPrimary) {
      // Check for aliases
      const aliases = await this.getAliases({
        sId: series.id!,
        xsId: series.xseriesId!,
      });
      if (aliases.length > 0) {
        throw new SeriesDeleteError(
          `Cannot delete primary series ${series.name} with ${aliases.length} alias(es). Delete aliases first.`,
        );
      }
    }

    // Check for dependents (other series whose loaders reference this name)
    if (!opts?.force) {
      const dependentRows = await mysql<{ id: number }>`
        SELECT ds.id
        FROM data_sources ds
        WHERE ds.disabled = 0
          AND JSON_CONTAINS(ds.dependencies, ${JSON.stringify(series.name)})
        LIMIT 1
      `;
      if (dependentRows.length > 0) {
        throw new SeriesDeleteError(
          `Cannot delete series ${series.name} — other series depend on it. Remove dependencies first.`,
        );
      }
    }

    // Delete public data points
    await mysql`DELETE FROM public_data_points WHERE series_id = ${id}`;

    // Delete loaders (data_sources) and their sub-records
    await mysql`
      DELETE dsa FROM data_source_actions dsa
      JOIN data_sources ds ON ds.id = dsa.data_source_id
      WHERE ds.series_id = ${id}
    `;
    await mysql`
      DELETE dsd FROM data_source_downloads dsd
      JOIN data_sources ds ON ds.id = dsd.data_source_id
      WHERE ds.series_id = ${id}
    `;
    await mysql`DELETE FROM data_sources WHERE series_id = ${id}`;

    // Delete join-table records
    await mysql`DELETE FROM measurement_series WHERE series_id = ${id}`;
    await mysql`DELETE FROM export_series WHERE series_id = ${id}`;
    await mysql`DELETE FROM user_series WHERE series_id = ${id}`;

    if (series.isPrimary && series.xseriesId) {
      // Clear FK to avoid constraint violation
      await mysql`
        UPDATE xseries SET primary_series_id = NULL WHERE id = ${series.xseriesId}
      `;
      // Delete the series row
      await mysql`DELETE FROM series WHERE id = ${id}`;
      // Delete the xseries (cascades to data_points)
      await TimeSeriesCollection.delete(series.xseriesId);
    } else {
      // Alias: just remove the series row
      await mysql`DELETE FROM series WHERE id = ${id}`;
    }
  }

  /**
   * Create an alias of an existing primary series into another universe.
   * The alias shares the same xseries (same data points).
   */
  static async createAlias(
    primarySeriesId: number,
    opts: { universe: Universe; name?: string; geographyId?: number },
  ): Promise<Series> {
    const primary = await this.getById(primarySeriesId);

    if (!primary.isPrimary) {
      throw new Error(
        `${primary.name} is not a primary series, cannot be aliased`,
      );
    }
    if (opts.universe === primary.universe) {
      throw new Error(
        `Cannot alias ${primary.name} into same universe ${opts.universe}`,
      );
    }

    const aliasName = opts.name ?? primary.name;

    // Check name doesn't already exist in the target universe
    const existingRows = await mysql<{ id: number }>`
      SELECT id FROM series
      WHERE universe = ${opts.universe} AND name = ${aliasName}
      LIMIT 1
    `;
    if (existingRows.length > 0) {
      throw new Error(`${aliasName} already exists in ${opts.universe}`);
    }

    // Resolve geography in the target universe
    let geoId = opts.geographyId ?? null;
    if (!geoId) {
      const parsed = Series.parseName(aliasName);
      const geoRows = await mysql<{ id: number }>`
        SELECT id FROM geographies
        WHERE universe = ${opts.universe} AND handle = ${parsed.geo}
        LIMIT 1
      `;
      if (!geoRows[0]) {
        throw new Error(
          `No geography ${parsed.geo} in universe ${opts.universe}`,
        );
      }
      geoId = geoRows[0].id;
    }

    // Insert the alias series pointing to the same xseries
    await mysql`
      INSERT INTO series (
        xseries_id, name, universe, geography_id, unit_id, source_id,
        source_detail_id, dataPortalName, description, decimals,
        source_link, investigation_notes, dependency_depth, scratch,
        created_at, updated_at
      ) VALUES (
        ${primary.xseriesId},
        ${aliasName},
        ${opts.universe},
        ${geoId},
        ${primary.unitId},
        ${primary.sourceId},
        ${primary.sourceDetailId},
        ${primary.dataPortalName},
        ${primary.description},
        ${primary.decimals},
        ${primary.sourceLink},
        ${primary.investigationNotes},
        ${primary.dependencyDepth},
        ${0},
        NOW(),
        NOW()
      )
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Delete series data points with optional date filtering */
  static async deleteDataPoints(opts: {
    id: number;
    u: Universe;
    deleteBy: "observationDate" | "vintageDate" | "none";
    date?: string;
  }) {
    const { id, u, deleteBy, date } = opts;
    if (deleteBy === "observationDate" && date) {
      await this.deleteDataPointsByObservationDate({ id, u, date });
      await this.repairDataPoints({ id });
    }
    if (deleteBy === "vintageDate" && date) {
      await this.deleteDataPointsByVintage({ id, u, date });
      await this.repairDataPoints({ id });
    }
    if (deleteBy === "none") {
      await this.deleteAllDataPoints({ id, u });
    }

    return "ok";
  }

  static async repairDataPoints(opts: { id: number }) {
    const { id } = opts;
    const needRepairDates = await mysql<{ date: Date }>`
      SELECT DISTINCT dp.date
      FROM data_points dp
      WHERE dp.xseries_id = ${id}
        AND NOT EXISTS (
          SELECT 1 FROM data_points current_dp
          WHERE current_dp.xseries_id = dp.xseries_id
            AND current_dp.date = dp.date
            AND current_dp.current = true
        )
    `;

    for (const dateRow of needRepairDates) {
      const latest = await mysql<{ created_at: Date; data_source_id: number }>`
        SELECT created_at, data_source_id FROM data_points
        WHERE xseries_id = ${id} AND date = ${dateRow.date}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (latest.length > 0) {
        await mysql`
          UPDATE data_points
          SET current = true
          WHERE xseries_id = ${id}
            AND date = ${dateRow.date}
            AND created_at = ${latest[0].created_at}
            AND data_source_id = ${latest[0].data_source_id}
        `;
      }
    }
  }

  static async getSeriesDates(opts: { id: number }) {
    return mysql`
      SELECT DISTINCT date
      FROM data_points
      WHERE xseries_id = ${opts.id}
      ORDER BY date
    `;
  }

  static async deleteAllDataPoints(opts: { id: number; u: Universe }) {
    return mysql`DELETE FROM data_points WHERE xseries_id = ${opts.id}`;
  }

  static async deleteDataPointsByObservationDate(opts: {
    id: number;
    u: Universe;
    date: string;
  }) {
    return mysql`DELETE FROM data_points WHERE xseries_id = ${opts.id} AND date >= ${opts.date}`;
  }

  static async deleteDataPointsByVintage(opts: {
    id: number;
    u: Universe;
    date: string;
  }) {
    return mysql`DELETE FROM data_points WHERE xseries_id = ${opts.id} AND created_at > ${opts.date}`;
  }

  /** Fetch aliases for a series, returned as Series model instances */
  static async getAliases(opts: {
    sId: number;
    xsId: number;
  }): Promise<Series[]> {
    const { sId, xsId } = opts;
    const rows = await mysql<SeriesAttrs>`
      SELECT
        s.id, s.xseries_id, s.geography_id, s.unit_id, s.source_id,
        s.source_detail_id, s.universe, s.decimals, s.name, s.dataPortalName,
        s.description, s.created_at, s.updated_at, s.dependency_depth,
        s.source_link, s.investigation_notes, s.scratch,
        x.primary_series_id, x.frequency, x.restricted, x.quarantined,
        x.seasonal_adjustment, x.seasonally_adjusted, x.aremos_missing,
        x.aremos_diff, x.percent, x.real
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      WHERE s.xseries_id = ${xsId}
      AND s.id <> ${sId}
      ORDER BY
      CASE
        WHEN s.id = (
          SELECT primary_series_id
          FROM xseries
          WHERE id = ${xsId}
        )
        THEN 0 ELSE 1 END,
      s.universe
    `;
    return rows.map((row) => new Series(row));
  }

  /** Search series with operator-rich query syntax.
   *
   * Operators (prefix each term):
   *   /u or /UHERO  — filter by universe
   *   +N            — override result limit
   *   =NAME         — exact name match
   *   ^PATTERN      — prefix starts with (regex, anchored)
   *   ~PATTERN      — prefix matches (regex, unanchored)
   *   @GEO[,GEO]    — geography filter (supports HIALL, HI5, CNTY aliases)
   *   .FREQ         — frequency filter (A, S, Q, M, W, D)
   *   :LINK          — source_link regex  (:: searches source table too)
   *   #PATTERN      — data-source eval regex
   *   !PATTERN      — data-source last_error regex
   *   ;res=IDS      — resource ID filter (unit, src, det)
   *   &FLAG         — boolean flags: pub, pct, nodpn, sa, ns, nodata, noclock, hasph
   *   {PATTERN      — dataPortalName regex
   *   }PATTERN      — description regex
   *   firstOP DATE  — filter by MIN observation date (e.g. first>=2020-01-01)
   *   lastOP DATE   — filter by MAX observation date
   *   123 or 1,2,3  — direct series-ID lookup
   *   (default)     — regex against name prefix | portalName | description
   *
   * Prefix any term with `-` to negate.
   * Commas inside patterns become `|` (OR); use `,,` for a literal comma.
   */
  static async search({
    text,
    limit = 10000,
    universe,
  }: {
    text: string;
    limit?: number;
    universe: Universe | string;
  }): Promise<Series[]> {
    if (text.length < 1) throw new Error("Invalid search term");

    const joins = ["INNER JOIN xseries ON xseries.id = series.xseries_id"];
    const conditions: string[] = [];
    const variables: (string | number | Date)[] = [];
    let univ: string | null = universe as string;

    const OPERATORS = "^+~@.#!:;&/={}";
    const terms = text.split(/\s+/).filter(Boolean);

    for (let i = 0; i < terms.length; i++) {
      let term = terms[i];
      let negated = "";

      if (term[0] === "-") {
        negated = "NOT ";
        term = term.slice(1);
      }
      if (!term) continue;

      const op = term[0];
      const val = term.slice(1);
      const isOp = op !== undefined && OPERATORS.includes(op);

      if (isOp) {
        switch (op) {
          case "/": {
            const abbrevs: Record<string, Universe> = {
              u: "UHERO",
              db: "DBEDT",
            };
            univ = abbrevs[val] ?? val;
            if (!isValidUniverse(univ))
              throw new Error(`Unknown universe ${univ}`);
            break;
          }
          case "+": {
            const n = parseInt(val);
            if (isNaN(n) || n <= 0) throw new Error(`Invalid limit ${val}`);
            limit = n;
            break;
          }
          case "=":
            conditions.push("series.name = ?");
            variables.push(val);
            break;
          case "^":
            conditions.push(
              `substring_index(series.name,'@',1) ${negated}regexp ?`,
            );
            variables.push(`^(${convertCommas(val)})`);
            break;
          case "~":
            conditions.push(
              `substring_index(series.name,'@',1) ${negated}regexp ?`,
            );
            variables.push(convertCommas(val));
            break;
          case ":":
            if (val.startsWith(":")) {
              joins.push(
                "LEFT OUTER JOIN sources ON sources.id = series.source_id",
              );
              conditions.push(
                `concat(coalesce(source_link,''),'|',coalesce(sources.link,'')) ${negated}regexp ?`,
              );
              variables.push(convertCommas(val.slice(1)));
            } else {
              conditions.push(`source_link ${negated}regexp ?`);
              variables.push(convertCommas(val));
            }
            break;
          case "@": {
            const geoMap: Record<string, string[]> = {
              HIALL: [
                "HI5",
                "NBI",
                "MOL",
                "MAUI",
                "LAN",
                "HAWH",
                "HAWK",
                "HIONLY",
              ],
              HI5: ["HI", "CNTY"],
              CNTY: ["HAW", "HON", "KAU", "MAU"],
            };
            joins.push(
              "INNER JOIN geographies ON geographies.id = series.geography_id",
            );
            const geos = val
              .split(",")
              .flatMap((g) => geoMap[g.toUpperCase()] ?? [g.toUpperCase()]);
            conditions.push(
              `geographies.handle ${negated}in (${geos.map(() => "?").join(",")})`,
            );
            variables.push(...geos);
            break;
          }
          case ".": {
            const freqs = val.replace(/,/g, "").split("");
            conditions.push(
              `xseries.frequency ${negated}in (${freqs.map(() => "?").join(",")})`,
            );
            variables.push(
              ...freqs.map((f) => Series.frequencyFromCode(f) ?? f),
            );
            break;
          }
          case "#": {
            if (negated) throw new Error("Cannot negate # search terms");
            joins.push(
              "INNER JOIN data_sources AS l1 ON l1.series_id = series.id AND NOT(l1.disabled)",
            );
            const trailingOp = val.match(/([*/])(\d+)$/);
            const evalPattern = trailingOp
              ? `\\s*\\${trailingOp[1]}\\s*${trailingOp[2]}\\s*$`
              : convertCommas(val);
            conditions.push("l1.eval regexp ?");
            variables.push(evalPattern);
            break;
          }
          case "!":
            if (negated) throw new Error("Cannot negate ! search terms");
            joins.push(
              "INNER JOIN data_sources AS l2 ON l2.series_id = series.id AND NOT(l2.disabled)",
            );
            conditions.push("l2.last_error regexp ?");
            variables.push(convertCommas(val));
            break;
          case ";": {
            const [res, idList] = val.split("=");
            const resCol: Record<string, string> = {
              unit: "unit_id",
              src: "source_id",
              det: "source_detail_id",
            };
            const col = resCol[res];
            if (!col) throw new Error(`Unknown resource type ${res}`);
            const ids = idList.split(",").map(Number);
            conditions.push(
              `${col} ${negated}in (${ids.map(() => "?").join(",")})`,
            );
            variables.push(...ids);
            break;
          }
          case "&": {
            const flag = val.toLowerCase();
            if (flag === "pub") {
              conditions.push(`restricted IS ${negated}FALSE`);
              break;
            }
            if (flag === "pct") {
              conditions.push(`percent IS ${negated}TRUE`);
              break;
            }
            if (flag === "nodpn") {
              conditions.push(`dataPortalName IS ${negated}NULL`);
              break;
            }
            if (flag === "sa") {
              if (negated) throw new Error("Cannot negate &sa");
              conditions.push("seasonal_adjustment = 'seasonally_adjusted'");
              break;
            }
            if (flag === "ns") {
              if (negated) throw new Error("Cannot negate &ns");
              conditions.push(
                "seasonal_adjustment = 'not_seasonally_adjusted'",
              );
              break;
            }
            if (flag === "nodata") {
              if (negated) throw new Error("Cannot negate &nodata");
              conditions.push(
                "(NOT EXISTS(SELECT * FROM data_points WHERE xseries_id = xseries.id AND current))",
              );
              break;
            }
            if (flag === "noclock") {
              if (negated) throw new Error("Cannot negate &noclock");
              joins.push(
                "INNER JOIN data_sources AS l3 ON l3.series_id = series.id AND NOT(l3.disabled)",
              );
              conditions.push("l3.reload_nightly IS FALSE");
              break;
            }
            if (flag === "hasph") {
              if (negated) throw new Error("Cannot negate &hasph");
              joins.push(
                "INNER JOIN data_sources AS l4 ON l4.series_id = series.id AND NOT(l4.disabled)",
              );
              conditions.push("l4.pseudo_history IS TRUE");
              break;
            }
            throw new Error(`Unknown fixed term &${flag}`);
          }
          case "{":
            conditions.push(`dataPortalName ${negated}regexp ?`);
            variables.push(convertCommas(val));
            break;
          case "}":
            conditions.push(`series.description ${negated}regexp ?`);
            variables.push(convertCommas(val));
            break;
        }
        continue;
      }

      // ── Non-operator terms ──────────────────────────────────────────

      // Numeric: series ID(s)
      if (/^\d+\b/.test(term)) {
        if (conditions.length > 0) {
          // Already have other conditions — treat as text search instead
          conditions.push(
            `concat(substring_index(series.name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(series.description,'')) ${negated}regexp ?`,
          );
          variables.push(convertCommas(term));
          continue;
        }
        // Entire input is comma-separated IDs
        const sids = text.replace(/\s+/g, "").split(",").map(Number);
        conditions.push(`series.id in (${sids.map(() => "?").join(",")})`);
        variables.push(...sids);
        univ = null;
        break;
      }

      // Date range: first>=2020-01-01, last<2023-06-30, etc.
      const dateMatch = term.match(/^(first|last)([<>]=?)(.*)/);
      if (dateMatch) {
        if (negated) throw new Error("Cannot negate date range search terms");
        const aggFunc = dateMatch[1] === "first" ? "MIN" : "MAX";
        conditions.push(
          `xseries.id IN (SELECT dp.xseries_id FROM data_points dp WHERE dp.current = 1 AND dp.value IS NOT NULL GROUP BY dp.xseries_id HAVING ${aggFunc}(dp.date) ${dateMatch[2]} ?)`,
        );
        variables.push(dateMatch[3]);
        continue;
      }

      // Stray comma (malformed input)
      if (term.startsWith(",")) {
        throw new Error("Spaces cannot occur in comma-separated search lists");
      }

      // Default: regex against name-prefix | portalName | description
      conditions.push(
        `concat(substring_index(series.name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(series.description,'')) ${negated}regexp ?`,
      );
      variables.push(convertCommas(term.replace(/^["']/, "")));
    }

    // Universe filter
    if (univ) {
      conditions.push("series.universe = ?");
      variables.push(univ);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = [
      `SELECT DISTINCT`,
      `  series.id, series.xseries_id, series.geography_id, series.unit_id,`,
      `  series.source_id, series.source_detail_id, series.universe, series.decimals,`,
      `  series.name, series.dataPortalName, series.description, series.created_at,`,
      `  series.updated_at, series.dependency_depth, series.source_link,`,
      `  series.investigation_notes, series.scratch,`,
      `  xseries.primary_series_id, xseries.frequency, xseries.restricted,`,
      `  xseries.quarantined, xseries.seasonal_adjustment, xseries.seasonally_adjusted,`,
      `  xseries.aremos_missing, xseries.aremos_diff, xseries.percent, xseries.real`,
      `FROM series`,
      joins.join(" "),
      whereClause,
      `ORDER BY series.name`,
      `LIMIT ?`,
    ].join("\n");
    variables.push(limit);

    const rows = await rawQuery<SeriesAttrs>(sql, variables);
    return rows.map((row) => new Series(row));
  }

  /** Resolve a list of series names to a name→id map. Unknown names are omitted. */
  static async getIdsByNames(names: string[]): Promise<Record<string, number>> {
    if (names.length === 0) return {};
    const rows = await mysql<{ name: string; id: number }>`
      SELECT name, id FROM series WHERE name IN ${mysql(names)}
    `;
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.name] = row.id;
    }
    return map;
  }

  // ─── Data point persistence ──────────────────────────────────────

  /**
   * Persist a map of date→value data points for a series.
   *
   * Only writes when data actually changes:
   *  - If a date already has a current data point with the same value,
   *    no new row is inserted (avoids vintage bloat).
   *  - If the value differs, the old point is marked non-current and a
   *    new vintage is inserted.
   *  - Brand-new dates are inserted directly.
   *  - The sentinel value (1e15) means "no data" and marks existing
   *    points as non-current.
   */
  static async updateData(opts: {
    xseriesId: number;
    data: Map<string, number>;
    dataSourceId: number;
    pseudoHistory: boolean;
  }): Promise<void> {
    const { xseriesId, data, dataSourceId, pseudoHistory } = opts;
    const SENTINEL = 1.0e15;

    // Remove nil/undefined values
    const cleanData = new Map<string, number>();
    for (const [date, value] of data) {
      if (value != null) cleanData.set(date, value);
    }

    if (cleanData.size === 0) return;

    // Get this loader's priority
    const loaderRows = await mysql<{ priority: number | null }>`
      SELECT priority FROM data_sources WHERE id = ${dataSourceId}
    `;
    const loaderPriority = loaderRows[0]?.priority ?? 100;

    // Get this loader's most recent data point per date (for dedup).
    // Uses the latest data point regardless of current flag — another loader
    // may have set ours to current=0, but we still don't need to re-insert
    // if the value hasn't changed.
    const ownRows = await mysql<{
      date: Date;
      value: number | null;
      created_at: Date;
    }>`
      SELECT date, value, created_at
      FROM data_points
      WHERE xseries_id = ${xseriesId} AND data_source_id = ${dataSourceId}
      ORDER BY created_at DESC
    `;
    const ownLatestByDate = new Map<string, number | null>();
    for (const row of ownRows) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date);
      if (!ownLatestByDate.has(dateStr)) {
        ownLatestByDate.set(dateStr, row.value);
      }
    }

    // Get existing current data points with their loader's priority
    const currentRows = await mysql<{
      date: Date;
      value: number | null;
      data_source_id: number;
      priority: number;
    }>`
      SELECT dp.date, dp.value, dp.data_source_id,
             COALESCE(ds.priority, 100) as priority
      FROM data_points dp
      LEFT JOIN data_sources ds ON dp.data_source_id = ds.id
      WHERE dp.xseries_id = ${xseriesId} AND dp.current = 1
    `;
    const currentByDate = new Map<
      string,
      { value: number | null; dataSourceId: number; priority: number }
    >();
    for (const row of currentRows) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date);
      const existing = currentByDate.get(dateStr);
      // Keep the highest priority current data point
      if (!existing || row.priority > existing.priority) {
        currentByDate.set(dateStr, {
          value: row.value,
          dataSourceId: row.data_source_id,
          priority: row.priority,
        });
      }
    }

    for (const [dateStr, newValue] of cleanData) {
      if (newValue === SENTINEL) {
        // Sentinel means "no data" — mark existing points as non-current
        await mysql`
          UPDATE data_points SET current = 0
          WHERE xseries_id = ${xseriesId} AND date = ${dateStr} AND current = 1
        `;
        continue;
      }

      const current = currentByDate.get(dateStr);

      // Dedup: if this loader's most recent data point for this date already
      // has the same value, don't insert a new row. But we may still need to
      // reclaim the `current` flag if a lower-priority loader currently holds it.
      const ownLatest = ownLatestByDate.get(dateStr);
      if (ownLatest !== undefined && ownLatest === newValue) {
        // Already current from this loader — nothing to do
        if (current && current.dataSourceId === dataSourceId) {
          continue;
        }
        // Current is held by a higher-priority loader — don't touch it
        if (current && current.priority > loaderPriority) {
          continue;
        }
        // Current is held by a lower/equal-priority loader — reclaim it
        // by pointing current to this loader's existing data point (no new insert)
        if (current) {
          await mysql`
            UPDATE data_points SET current = 0
            WHERE xseries_id = ${xseriesId} AND date = ${dateStr} AND current = 1
          `;
          await mysql`
            UPDATE data_points SET current = 1
            WHERE xseries_id = ${xseriesId} AND date = ${dateStr}
              AND data_source_id = ${dataSourceId}
            ORDER BY created_at DESC LIMIT 1
          `;
        }
        continue;
      }

      // Priority check: don't overwrite a higher-priority loader's current point
      if (
        current &&
        current.dataSourceId !== dataSourceId &&
        current.priority > loaderPriority
      ) {
        continue;
      }

      // Mark old current as non-current
      if (current) {
        await mysql`
          UPDATE data_points SET current = 0
          WHERE xseries_id = ${xseriesId} AND date = ${dateStr} AND current = 1
        `;
      }

      // Insert new data point
      await mysql`
        INSERT INTO data_points (xseries_id, date, value, created_at, updated_at, current, pseudo_history, data_source_id)
        VALUES (${xseriesId}, ${dateStr}, ${newValue}, NOW(), NOW(), 1, ${pseudoHistory ? 1 : 0}, ${dataSourceId})
      `;
    }
  }

  // ─── Static loader stubs (eval-callable) ─────────────────────────

  /** Load series data from a named download source. */
  static async loadFromDownload(
    handle: string,
    options: Record<string, unknown> = {},
  ): Promise<Series> {
    const { default: DownloadProcessor } =
      await import("../utils/download-processor");
    const data = await DownloadProcessor.getData(
      handle,
      options as Record<string, string | number | boolean>,
    );
    const freqCode = options.frequency ? String(options.frequency) : null;
    const freq = Series.frequencyFromCode(freqCode);
    const result = new Series({ name: `loaded from download <${handle}>` });
    result.data = data;
    if (freq) result.frequency = freq;
    return result;
  }

  /** Load series data from a file path using DownloadProcessor cell navigation.
   *  Equivalent to Rails: Series.load_from_file(path, options)
   *  Uses the same row/col/sheet/frequency options as loadFromDownload,
   *  but reads from a direct file path instead of a download handle.
   */
  static async loadFromFile(
    path: string,
    options: Record<string, unknown> = {},
  ): Promise<Series> {
    const { default: DownloadProcessor } =
      await import("../utils/download-processor");
    const isDateSensitive = path.includes("%");
    const data = await DownloadProcessor.getData(":manual", {
      ...options,
      path,
    } as Record<string, string | number | boolean>);
    const freqCode = options.frequency ? String(options.frequency) : null;
    const freq = Series.frequencyFromCode(freqCode);
    const description = isDateSensitive
      ? `loaded from set of static files ${path} with options shown`
      : `loaded from static file <${path}> with options shown`;
    const result = new Series({ name: description });
    result.data = data;
    if (freq) result.frequency = freq;
    return result;
  }

  /** Load from the BLS API (v1 legacy endpoint). */
  static async loadApiBls(
    seriesId: string,
    frequency: string,
  ): Promise<Series> {
    const { fetchSeries } = await import("../utils/api-clients/bls");
    const { data, url } = await fetchSeries(seriesId, frequency);
    return this.wrapApiResult(data, url, frequency);
  }

  /** Load from the BLS API (v2 endpoint). */
  static async loadApiBlsV2(
    seriesId: string,
    frequency: string,
  ): Promise<Series> {
    const { fetchSeriesV2 } = await import("../utils/api-clients/bls");
    const { data, url } = await fetchSeriesV2(seriesId, frequency);
    return this.wrapApiResult(data, url, frequency);
  }

  /** Load from the FRED API. */
  static async loadApiFred(
    code: string,
    frequency?: string,
    aggMethod?: string,
  ): Promise<Series> {
    const { fetchSeries } = await import("../utils/api-clients/fred");
    const { data, url } = await fetchSeries(code, frequency, aggMethod);
    return this.wrapApiResult(data, url, frequency);
  }

  /** Load from the BEA API. */
  static async loadApiBea(
    frequency: string,
    dataset: string,
    params: Record<string, string> = {},
  ): Promise<Series> {
    const { fetchSeries } = await import("../utils/api-clients/bea");
    const { data, url } = await fetchSeries(dataset, params);
    return this.wrapApiResult(data, url, frequency);
  }

  /** Load from the Japan e-Stat API (monthly data only). */
  static async loadApiEstatjp(
    code: string,
    filters: Record<string, string> = {},
  ): Promise<Series> {
    const { fetchSeries } = await import("../utils/api-clients/estat-jp");
    const { data, url } = await fetchSeries(code, filters);
    return this.wrapApiResult(data, url, "M");
  }

  /** Load from the EIA Annual Energy Outlook API. */
  static async loadApiEiaAeo(
    options: Record<string, string> = {},
  ): Promise<Series> {
    const {
      route,
      scenario,
      seriesId,
      frequency = "annual",
      value_in = "value",
    } = options;
    if (!route || !scenario || !seriesId) {
      throw new Error(
        "route, scenario, and seriesId are all required parameters",
      );
    }
    const { fetchSeries } = await import("../utils/api-clients/eia");
    const { data, url } = await fetchSeries(
      route,
      scenario,
      seriesId,
      frequency,
      value_in,
    );
    const freqCode = Series.codeFromFrequency(frequency);
    return this.wrapApiResult(data, url, freqCode);
  }

  /** Load from the EIA Short-Term Energy Outlook API. */
  static async loadApiEiaSteo(
    options: Record<string, string> = {},
  ): Promise<Series> {
    const { seriesId, frequency = "monthly", value_in = "value" } = options;
    if (!seriesId) throw new Error("seriesId is a required parameter");
    const { fetchSeries } = await import("../utils/api-clients/eia");
    const { data, url } = await fetchSeries(
      "steo",
      null,
      seriesId,
      frequency,
      value_in,
    );
    const freqCode = Series.codeFromFrequency(frequency);
    return this.wrapApiResult(data, url, freqCode);
  }

  /** Load from the DVW API. */
  static async loadApiDvw(
    mod: string,
    freq: string,
    indicator: string,
    dimensions: Record<string, string>,
  ): Promise<Series> {
    const { fetchSeries } = await import("../utils/api-clients/dvw");
    const { data, url } = await fetchSeries(mod, freq, indicator, dimensions);
    return this.wrapApiResult(data, url, freq);
  }

  /** Wrap an API result into a Series with description and frequency. */
  private static wrapApiResult(
    data: Map<string, number>,
    url: string,
    freqCodeOrName?: string | null,
  ): Series {
    const link = `<a href="${url}">API URL</a>`;
    const description =
      data.size > 0
        ? `loaded data set from ${link} with parameters shown`
        : `No data collected from ${link} - possibly redacted`;
    const result = new Series({ name: description });
    result.data = data;
    const freq = Series.frequencyFromCode(freqCodeOrName ?? null);
    if (freq) result.frequency = freq;
    return result;
  }

  /** Find sibling series across all 6 frequency codes. */
  static async getFrequencySiblings(
    series: Series,
  ): Promise<Array<{ freqCode: string; id: number; name: string }>> {
    const freqCodes = ["A", "S", "Q", "M", "W", "D"] as const;
    const candidateNames: string[] = [];
    for (const code of freqCodes) {
      try {
        candidateNames.push(
          series.buildName({
            freq: code as import("../models/series").FrequencyCode,
          }),
        );
      } catch {
        // name can't be built with this freq — skip
      }
    }
    if (candidateNames.length === 0) return [];

    const rows = await mysql<{ id: number; name: string }>`
      SELECT id, name FROM series
      WHERE name IN ${mysql(candidateNames)} AND universe = ${series.universe}
    `;

    return rows.map((row) => {
      const parsed = Series.parseName(row.name);
      return { freqCode: parsed.freq ?? "A", id: row.id, name: row.name };
    });
  }

  // Delegate to model for name/universe validation
  static isValidName = Series.isValidName;
  static isValidUniverse = isValidUniverse;

  // ─── Null-field audit ───────────────────────────────────────────────

  /** Allowlisted field keys → SQL column expressions */
  private static readonly NULL_FIELD_COLUMNS: Record<
    string,
    { column: string; isText: boolean }
  > = {
    source_id: { column: "s.source_id", isText: false },
    unit_id: { column: "s.unit_id", isText: false },
    source_detail_id: { column: "s.source_detail_id", isText: false },
    geography_id: { column: "s.geography_id", isText: false },
    dataPortalName: { column: "s.dataPortalName", isText: true },
    description: { column: "s.description", isText: true },
    source_link: { column: "s.source_link", isText: true },
  };

  static async getWithNullField(
    universe: string,
    field: string,
    page: number = 1,
    perPage: number = 50,
  ): Promise<{ rows: SeriesAuditRow[]; totalCount: number }> {
    const spec = SeriesCollection.NULL_FIELD_COLUMNS[field];
    if (!spec) {
      throw new Error(`Invalid null-field audit key: ${field}`);
    }

    const nullCheck = spec.isText
      ? `(${spec.column} IS NULL OR ${spec.column} = '')`
      : `${spec.column} IS NULL`;

    const offset = (page - 1) * perPage;

    const countRows = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM series s WHERE s.universe = ? AND ${nullCheck}`,
      [universe],
    );
    const totalCount = countRows[0]?.cnt ?? 0;

    if (totalCount === 0) return { rows: [], totalCount: 0 };

    const seriesRows = await rawQuery<{
      id: number;
      name: string;
      dataPortalName: string | null;
    }>(
      `SELECT s.id, s.name, s.dataPortalName
       FROM series s
       WHERE s.universe = ? AND ${nullCheck}
       ORDER BY s.name
       LIMIT ? OFFSET ?`,
      [universe, perPage, offset],
    );

    if (seriesRows.length === 0) return { rows: [], totalCount };

    return {
      rows: await SeriesCollection.attachLoaderEvals(seriesRows),
      totalCount,
    };
  }

  // ─── Quarantine ─────────────────────────────────────────────────────

  static async getQuarantined(
    universe: string,
    page: number = 1,
    perPage: number = 50,
  ): Promise<{ rows: SeriesAuditRow[]; totalCount: number }> {
    const offset = (page - 1) * perPage;

    const countRows = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt
       FROM series s
       INNER JOIN xseries x ON s.xseries_id = x.id
       WHERE s.universe = ? AND x.quarantined = 1`,
      [universe],
    );
    const totalCount = countRows[0]?.cnt ?? 0;

    if (totalCount === 0) return { rows: [], totalCount: 0 };

    const seriesRows = await rawQuery<{
      id: number;
      name: string;
      dataPortalName: string | null;
    }>(
      `SELECT s.id, s.name, s.dataPortalName
       FROM series s
       INNER JOIN xseries x ON s.xseries_id = x.id
       WHERE s.universe = ? AND x.quarantined = 1
       ORDER BY s.name
       LIMIT ? OFFSET ?`,
      [universe, perPage, offset],
    );

    if (seriesRows.length === 0) return { rows: [], totalCount };

    return {
      rows: await SeriesCollection.attachLoaderEvals(seriesRows),
      totalCount,
    };
  }

  static async unquarantine(seriesId: number): Promise<void> {
    await rawQuery(
      `UPDATE xseries SET quarantined = 0
       WHERE id = (SELECT xseries_id FROM series WHERE id = ?)`,
      [seriesId],
    );
  }

  static async emptyQuarantine(universe: string): Promise<number> {
    const result = await rawQuery<{ affectedRows?: number }>(
      `UPDATE xseries x
       INNER JOIN series s ON s.xseries_id = x.id
       SET x.quarantined = 0
       WHERE s.universe = ? AND x.quarantined = 1`,
      [universe],
    );
    // rawQuery returns row array; for UPDATE, Bun SQL returns [{affectedRows}]
    return (result as unknown as { count: number }).count ?? 0;
  }

  // ─── Shared helpers ─────────────────────────────────────────────────

  /** Fetch enabled loader evals for a set of series and attach them. */
  private static async attachLoaderEvals(
    seriesRows: { id: number; name: string; dataPortalName: string | null }[],
  ): Promise<SeriesAuditRow[]> {
    const ids = seriesRows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const loaderRows = await rawQuery<{
      series_id: number;
      eval: string | null;
    }>(
      `SELECT series_id, eval FROM data_sources
       WHERE series_id IN (${placeholders}) AND disabled = 0
       ORDER BY series_id, priority`,
      ids,
    );

    const loaderMap = new Map<number, string[]>();
    for (const lr of loaderRows) {
      if (!lr.eval) continue;
      const arr = loaderMap.get(lr.series_id) ?? [];
      arr.push(lr.eval);
      loaderMap.set(lr.series_id, arr);
    }

    return seriesRows.map((r) => ({
      id: r.id,
      name: r.name,
      dataPortalName: r.dataPortalName,
      loaderEvals: loaderMap.get(r.id) ?? [],
    }));
  }
}

export class SeriesDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesDeleteError";
  }
}

export default SeriesCollection;
