import { mysql } from "@/lib/mysql/db";
import { convertCommas } from "@/lib/mysql/helpers";
import { SeriesMetadata, Universe } from "../types/shared";
import { isValidUniverse } from "../utils/validators";
import { SeriesSummary } from "../types/udaman";

class Series {
  /** Create a series record */
  static async create() {}

  static async getSeriesByName(seriesName: string): Promise<{
    name: string;
    id: number;
    aremos_missing: number | null;
    aremos_diff: number | null;
  }> {
    const rows = await mysql`
      SELECT
        s.id,
        s.name,
        x.aremos_missing,
        x.aremos_diff
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      WHERE s.name = ${seriesName}
      LIMIT 1
    `;

    const r = rows[0] as any;
    if (!r) throw new Error(`Series not found: ${seriesName}`);
    return {
      name: r.name,
      id: r.id,
      aremos_missing: r.aremos_missing,
      aremos_diff: r.aremos_diff,
    };
  }

  static async getSeriesMetadata({
    id,
  }: {
    id: number;
  }): Promise<SeriesMetadata> {
    // todo: remove unused fields after initial build
    const rows = await mysql`
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
    return rows[0] as SeriesMetadata;
  }

  /** Fetch the the most recent 40 series to display on the homepage.
   *
   * todo: set min and max dates on the xseries table and update them when a series is loaded.
   * todo: This would allow simplifying this to a single query and avoid the data_points table.
   */
  static async getSummaryList({
    offset,
    limit,
    universe,
  }: {
    offset?: number;
    limit?: number;
    universe: Universe;
  }) {
    // fetch initial data
    const mainRows = await mysql`
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

    const xseriesIds = mainRows.map((row: any) => row.xseriesId);

    if (xseriesIds.length > 0) {
      // Second query - get min/max dates only for the 40 series
      const dateRows = await mysql`
        SELECT
          xseries_id as id,
          MIN(date) as min_date,
          MAX(date) as max_date
        FROM data_points
        WHERE xseries_id IN ${mysql(xseriesIds)}
        GROUP BY xseries_id
      `;

      const dateMap = new Map(dateRows.map((row: any) => [row.id, row]));

      const finalRows: SeriesSummary[] = mainRows.map((row: any) => {
        const dateInfo = dateMap.get(row.xseriesId) as any;
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
    return mainRows.map((row: any) => ({
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

  /** Delete series from database */
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

  /** Use after partially deleting datapoints by vintage or observation date
   * to load the deleted datapoint where no other vintage exists */
  static async repairDataPoints(opts: { id: number }) {
    const { id } = opts;
    const needRepairDates = await mysql`
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
            WHERE xseries_id = ${id} AND date = ${(dateRow as any).date}
            ORDER BY created_at DESC
            LIMIT 1
          ) tmp
        )
      `;
    }
  }

  /** Retrieve distinct dates for a given series */
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

  static async getAliases(opts: { sId: number; xsId: number }) {
    const { sId, xsId } = opts;
    return mysql`
      SELECT * FROM series
      WHERE xseries_id = ${xsId}
      AND id <> ${sId}
      ORDER BY
      CASE
        WHEN id = (
          SELECT primary_series_id
          FROM xseries
          WHERE id = ${xsId}
        )
        THEN 0 ELSE 1 END,
      universe
    `;
  }

  /**
   * 1. join series & xseries
   * 2. univ defaults to UHERO
   * 3.
   */
  static async search({
    text,
    limit = 10000,
    user = null,
    universe,
  }: {
    text: string;
    limit: number;
    user: null;
    universe: Universe | string;
  }) {
    if (text.length < 1) throw new Error("Invalid search term");
    const joins = [`INNER JOIN xseries ON xseries.id = series.xseries_id`];
    const operators = "^+~-@.#!:;&/=";
    const conditions: string[] = [];
    const variables: any[] = [];
    let firstTerm = "";
    let negated = "";

    const terms = text.split(" ");
    for (let term of terms) {
      negated = "";
      if (term[0] === "-") {
        negated = "NOT ";
        term = term.slice(1);
      }

      const hasOperator = term[0] !== undefined && operators.includes(term[0]);
      const operator = term[0];

      if (hasOperator) {
        term = term.slice(1);
      }

      switch (operator) {
        case "/":
          const abbrevs: Record<string, Universe> = { u: "UHERO", db: "DBEDT" };
          universe = abbrevs[term] ?? term;
          if (!isValidUniverse(universe)) {
            throw new Error(`Unknown universe ${universe}`);
          }
          break;
        case "+":
          const newLimit = parseInt(term);
          if (isNaN(newLimit) || newLimit <= 0) {
            throw new Error(`Invalid limit ${term}`);
          }
          limit = newLimit;
          break;
        case "=":
          conditions.push(`series.name = ?`);
          variables.push(term);
          break;
        case "^":
          conditions.push(
            `substring_index(series.name,'@',1) ${negated}regexp ?`
          );
          variables.push(`^${convertCommas(term)}`);
          break;
        case "~":
          conditions.push(
            `substring_index(series.name,'@',1) ${negated}regexp ?`
          );
          variables.push(`~${convertCommas(term)}`);
          break;
        case ":":
          // ":: search sources.link && source_link"
          if (term.startsWith(":")) {
            joins.push(
              "left outer join sources on sources.id = series.source_id"
            );
            conditions.push(
              `concat(coalesce(source_link,''),'|',coalesce(sources.link,'')) ${negated}regexp ?`
            );
            variables.push(convertCommas(term.slice(1)));
          } else {
            conditions.push(`source_link ${negated}regexp ?`);
            variables.push(convertCommas(term));
          }
          break;
        case "@":
          // TODO: avoid hard coding things already stored in database.
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
            `INNER JOIN geographies ON geographies.id = series.geography_id`
          );
          const geos = term
            .split(",")
            .flatMap((g) => geoMap[g.toUpperCase()] || [g.toUpperCase()]);

          const geoQs = geos.map(() => "?").join(", ");
          conditions.push(`geographies.handle ${negated}in (${geoQs})`);
          variables.push(...geos);
          break;
        case ".":
          break;
        case "#":
          break
        case "!":
          break
        case ";":
          break
        case "&":
          break
        default:
          break;
      }
    }
  }

  static isValidName(str: string) {
    if (!str || !str.includes("@")) return false;

    // Simplified series name validation (XXXX@XXX.X format)
    const seriesNameRegex =
      /^([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?@(\w+?)(\.([ASQMWD]))?$/i;
    return seriesNameRegex.test(str);
  }

  static isValidUniverse(universe: Universe | string) {}
}

export default Series;
