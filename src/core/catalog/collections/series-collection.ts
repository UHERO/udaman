import { mysql, rawQuery } from "@/lib/mysql/db";
import { convertCommas } from "@/lib/mysql/helpers";

import Series from "../models/series";
import type { SeriesAttrs } from "../models/series";
import type { SeasonalAdjustment, SeriesMetadata, Universe } from "../types/shared";
import type { SeriesSummary } from "../types/udaman";
import { isValidUniverse } from "../utils/validators";

/** Row shape returned by the summary SELECT (before date enrichment). */
interface SeriesSummaryRow {
  name: string;
  id: number;
  xseriesId: number;
  seasonalAdjustment: SeasonalAdjustment;
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

class SeriesCollection {
  /** Create a series record */
  static async create() {}

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
        x.aremos_diff, x.percent, x.real
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      WHERE s.name = ${seriesName}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Series not found: ${seriesName}`);
    return new Series(row);
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
        x.aremos_diff, x.percent, x.real
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      WHERE s.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Series not found: ${id}`);
    return new Series(row);
  }

  /** Fetch the denormalized metadata view for a series (joined with geo, unit, source, etc.) */
  static async getSeriesMetadata({ id }: { id: number }): Promise<SeriesMetadata> {
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
    if (rows.length === 0)
      throw new Error("404 - Series not found: " + id);
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
      portalName: row.portalName,
      unitShortLabel: row.unitShortLabel,
      sourceDescription: row.sourceDescription,
      sourceUrl: row.sourceUrl,
      minDate: null,
      maxDate: null,
    }));
  }

  /** Update series data */
  static async update() {}

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
      await mysql`
        UPDATE data_points
        SET current = true
        WHERE id = (
          SELECT id FROM (
            SELECT id FROM data_points
            WHERE xseries_id = ${id} AND date = ${dateRow.date}
            ORDER BY created_at DESC
            LIMIT 1
          ) tmp
        )
      `;
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
  static async getAliases(opts: { sId: number; xsId: number }): Promise<Series[]> {
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
            const abbrevs: Record<string, Universe> = { u: "UHERO", db: "DBEDT" };
            univ = abbrevs[val] ?? val;
            if (!isValidUniverse(univ)) throw new Error(`Unknown universe ${univ}`);
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
            conditions.push(`substring_index(series.name,'@',1) ${negated}regexp ?`);
            variables.push(`^(${convertCommas(val)})`);
            break;
          case "~":
            conditions.push(`substring_index(series.name,'@',1) ${negated}regexp ?`);
            variables.push(convertCommas(val));
            break;
          case ":":
            if (val.startsWith(":")) {
              joins.push("LEFT OUTER JOIN sources ON sources.id = series.source_id");
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
              HIALL: ["HI5", "NBI", "MOL", "MAUI", "LAN", "HAWH", "HAWK", "HIONLY"],
              HI5: ["HI", "CNTY"],
              CNTY: ["HAW", "HON", "KAU", "MAU"],
            };
            joins.push("INNER JOIN geographies ON geographies.id = series.geography_id");
            const geos = val
              .split(",")
              .flatMap((g) => geoMap[g.toUpperCase()] ?? [g.toUpperCase()]);
            conditions.push(`geographies.handle ${negated}in (${geos.map(() => "?").join(",")})`);
            variables.push(...geos);
            break;
          }
          case ".": {
            const freqs = val.replace(/,/g, "").split("");
            conditions.push(`xseries.frequency ${negated}in (${freqs.map(() => "?").join(",")})`);
            variables.push(...freqs.map((f) => Series.frequencyFromCode(f) ?? f));
            break;
          }
          case "#": {
            if (negated) throw new Error("Cannot negate # search terms");
            joins.push("INNER JOIN data_sources AS l1 ON l1.series_id = series.id AND NOT(l1.disabled)");
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
            joins.push("INNER JOIN data_sources AS l2 ON l2.series_id = series.id AND NOT(l2.disabled)");
            conditions.push("l2.last_error regexp ?");
            variables.push(convertCommas(val));
            break;
          case ";": {
            const [res, idList] = val.split("=");
            const resCol: Record<string, string> = { unit: "unit_id", src: "source_id", det: "source_detail_id" };
            const col = resCol[res];
            if (!col) throw new Error(`Unknown resource type ${res}`);
            const ids = idList.split(",").map(Number);
            conditions.push(`${col} ${negated}in (${ids.map(() => "?").join(",")})`);
            variables.push(...ids);
            break;
          }
          case "&": {
            const flag = val.toLowerCase();
            if (flag === "pub") { conditions.push(`restricted IS ${negated}FALSE`); break; }
            if (flag === "pct") { conditions.push(`percent IS ${negated}TRUE`); break; }
            if (flag === "nodpn") { conditions.push(`dataPortalName IS ${negated}NULL`); break; }
            if (flag === "sa") {
              if (negated) throw new Error("Cannot negate &sa");
              conditions.push("seasonal_adjustment = 'seasonally_adjusted'");
              break;
            }
            if (flag === "ns") {
              if (negated) throw new Error("Cannot negate &ns");
              conditions.push("seasonal_adjustment = 'not_seasonally_adjusted'");
              break;
            }
            if (flag === "nodata") {
              if (negated) throw new Error("Cannot negate &nodata");
              conditions.push("(NOT EXISTS(SELECT * FROM data_points WHERE xseries_id = xseries.id AND current))");
              break;
            }
            if (flag === "noclock") {
              if (negated) throw new Error("Cannot negate &noclock");
              joins.push("INNER JOIN data_sources AS l3 ON l3.series_id = series.id AND NOT(l3.disabled)");
              conditions.push("l3.reload_nightly IS FALSE");
              break;
            }
            if (flag === "hasph") {
              if (negated) throw new Error("Cannot negate &hasph");
              joins.push("INNER JOIN data_sources AS l4 ON l4.series_id = series.id AND NOT(l4.disabled)");
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
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

  // Delegate to model for name/universe validation
  static isValidName = Series.isValidName;
  static isValidUniverse = isValidUniverse;
}

export default SeriesCollection;
