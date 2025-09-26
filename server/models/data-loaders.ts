import { MySQLPromisePool } from "@fastify/mysql";
import { DataLoaderType, SourceMapNode } from "@shared/types/shared";
import { CreateLoaderPayload } from "@shared/types/sources";
import { app } from "app";
import { mysql } from "helpers/db";
import { queryDB } from "helpers/sql";

import Series from "./series";

/** Called data_sources in the database. Goal is to change it to data_loaders to
 * be less ambiguous, and not overlap with the source and source detail tables.
 */
export class DataLoaders {
  static async getSeriesLoaders({
    seriesId,
  }: {
    seriesId: number;
  }): Promise<DataLoaderType[]> {
    const query = mysql.format(
      `
        SELECT
            id,
            series_id,
            disabled,
            universe,
            priority,
            created_at,
            updated_at,
            reload_nightly,
            pseudo_history,
            clear_before_load,
            eval,
            scale,
            presave_hook,
            color,
            runtime,
            last_run_at,
            last_run_in_seconds,
            last_error,
            last_error_at,
            dependencies,
            description
        FROM data_sources ds
        WHERE ds.series_id = ?
        `,
      [seriesId]
    );

    const response = await queryDB(query);
    return response as DataLoaderType[];
  }

  static async getDataLoadersBySeriesId({
    seriesId,
  }: {
    seriesId: number;
  }): Promise<DataLoaderType[]> {
    const query = mysql.format(
      `
    SELECT 
      id,
      description,
      last_run_in_seconds,
      priority,
      disabled,
      eval,
      dependencies
    FROM data_sources 
    WHERE series_id = ? 
      AND disabled = 0
    ORDER BY priority ASC, last_run_in_seconds DESC
  `,
      [seriesId]
    );

    const response = await queryDB(query);
    return response as DataLoaderType[];
  }

  /** Iteratively fetches sources for use in series source map. Note that I attempted to move
   * this logic into a recursive SQL query, but it was very very slow for series with multiple
   * dependents. Implemented instead as a series of queries.
   */

  static async getDependencies({
    seriesName,
    directOnly = false,
  }: {
    seriesName: string;
    directOnly?: boolean;
  }): Promise<SourceMapNode[]> {
    const seen = new Set<string>();

    async function buildNodes(
      name: string,
      level: number
    ): Promise<SourceMapNode[]> {
      if (seen.has(name)) {
        return []; // Avoid infinite loops
      }
      seen.add(name);

      const query = mysql.format(
        `
      SELECT 
        s.name,
        ds.id,
        ds.series_id,
        ds.disabled,
        ds.universe,
        ds.color,
        ds.last_run_at,
        ds.last_run_in_seconds,
        ds.last_error,
        ds.last_error_at,
        ds.dependencies,
        ds.description,
        xs.aremos_missing,
        xs.aremos_diff
      FROM data_sources ds 
      JOIN series s ON s.id = ds.series_id 
      JOIN xseries xs ON xs.id = s.xseries_id 
      WHERE s.name = ? 
        AND ds.universe = 'UHERO' 
        AND ds.disabled = 0
    `,
        [name]
      );

      const results = await queryDB(query);

      if (results.length === 0) {
        return [];
      }

      const nodes: SourceMapNode[] = [];

      for (const row of results) {
        const children: SourceMapNode[] = [];
        if (row.dependencies) {
          const deps = _parseDependencyField(row.dependencies);
          for (const dep of deps) {
            if (!directOnly || level === 0) {
              const childNodes = await buildNodes(dep, level + 1);
              children.push(...childNodes);
            }
          }
        }

        nodes.push({
          name,
          children,
          level,
          dataSource: {
            id: row.id,
            series_id: row.series_id,
            disabled: !!row.disabled,
            universe: row.universe,
            color: row.color,
            last_run_at: row.last_run_at,
            last_run_in_seconds: row.last_run_in_seconds,
            last_error: row.last_error,
            dependencies: row.dependencies,
            description: row.description,
            aremos_missing: row.aremos_missing,
            aremos_diff: row.aremos_diff,
          },
        });
      }

      return nodes;
    }

    return buildNodes(seriesName, 0);
  }

  /**
   * insert record to db
   * set color
   * set dependencies
   */
  static async create(db: MySQLPromisePool, payload: CreateLoaderPayload) {
    const {
      seriesId,
      scale,
      code,
      priority,
      presaveHook,
      clearBeforeLoad,
      universe,
      pseudoHistory,
    } = payload;

    const loaderType = this._getLoaderType(code, pseudoHistory);
    app.log.info(loaderType);
    const colorPalette = this._getColor(loaderType);
    app.log.info(colorPalette);
    const description = this._generateDescriptionFromEval(code);
    app.log.info(description);

    const optimalColor = await this.calculateColor(
      seriesId,
      loaderType,
      colorPalette
    );

    const dependencies = this._extractDependencies(description || "", code);

    const query = mysql.format(
      `
        INSERT INTO data_sources (
          series_id, eval, priority, scale, presave_hook, 
          clear_before_load, pseudo_history, universe, disabled, 
          reload_nightly, color, dependencies,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  NOW(), NOW())
      `,
      [
        seriesId,
        code,
        priority || 50,
        scale || "1.0",
        presaveHook,
        clearBeforeLoad,
        pseudoHistory,
        universe,
        false, // disabled
        true, // reload_nightly
        optimalColor,
        JSON.stringify(dependencies), // serialized array
      ]
    );

    const response = await queryDB(query);
    app.log.info("233 \n");
    app.log.info(response);
    return response;
  }

  static async calculateColor(
    seriesId: number,
    loaderType: string,
    colorPalette: string[]
  ) {
    const query = mysql.format(
      `
      SELECT ds.color, COUNT(*) as usage_count
      FROM data_sources ds
      WHERE ds.series_id = ?
        AND ds.disabled = 0
        AND (
          (? = 'pseudo_history' AND ds.pseudo_history = 1) OR
          (? != 'pseudo_history' AND ds.pseudo_history = 0 AND 
           CASE 
             WHEN ds.eval REGEXP 'load_api' THEN 'api'
             WHEN ds.eval REGEXP 'forecast' THEN 'forecast' 
             WHEN ds.eval REGEXP 'load_from_download' THEN 'download'
             WHEN ds.eval REGEXP 'load_[a-z_]*from.*history' THEN 'history'
             WHEN ds.eval REGEXP 'load_[a-z_]*from' THEN 'manual'
             ELSE 'other'
           END = ?)
        )
      GROUP BY ds.color
    `,
      [seriesId, loaderType, loaderType, loaderType]
    );
    const existing = await queryDB(query);

    const usageMap = {};
    existing.forEach((row) => {
      if (colorPalette.includes(row.color)) {
        usageMap[row.color] = row.usage_count;
      }
    });

    // Find least used color
    let optimalColor = colorPalette[0];
    let minUsage = usageMap[optimalColor] || 0;

    for (const color of colorPalette) {
      const usage = usageMap[color] || 0;
      if (usage < minUsage) {
        optimalColor = color;
        minUsage = usage;
      }
    }

    return optimalColor;
  }
  /** Helper: Determine loader type from eval expression */
  static _getLoaderType(evalExpr: string, pseudoHistory = false) {
    if (pseudoHistory) return "pseudo_history";

    if (/load_api/.test(evalExpr)) return "api";
    if (/forecast/i.test(evalExpr)) return "forecast";
    if (/load_from_download/.test(evalExpr)) return "download";
    if (/load_[a-z_]*from.*history/i.test(evalExpr)) return "history";
    if (/load_[a-z_]*from/i.test(evalExpr)) return "manual";

    return "other"; // calculations/method calls
  }

  /**  */
  static _getColor(type: string) {
    const palettes: Record<string, string[]> = {
      api: ["B2A1EA", "CDC8FE", "A885EF"], // Purples
      forecast: ["FFA94E", "FFA500"], // Oranges
      download: ["A9BEF2", "C3DDF9", "6495ED"], // Blues
      manual: ["F9FF8B", "FBFFBD", "F0E67F"], // Yellows
      history: ["CAAF8C", "DFC3AA", "B78E5C"], // Browns
      pseudo_history: ["FEB4AA"], // Salmon
      other: ["9FDD8C", "D0F0C0", "88D3B2", "74C365"], // Greens
    };
    return palettes[type] || ["FFFFFF"];
  }

  /** Helper: Extract series name dependencies from text */
  static _extractDependencies(description: string, evalExpr: string) {
    const dependencies = new Set();
    const text = `${description} ${evalExpr}`;
    const words = text.split(/\s+/); // Split on whitespace and check each word

    for (const word of words) {
      if (Series.isValidName(word)) {
        dependencies.add(word);
      }
    }

    return Array.from(dependencies);
  }

  /** Parse eval expressions to generate human-readable descriptions */
  static _generateDescriptionFromEval(evalExpr: string) {
    // Handle aggregation: "SERIES@GEO.FREQ".ts.aggregate(:frequency, :operation)
    const aggregateMatch = evalExpr.match(
      /^"([^"]+)"\.ts\.aggregate\(:(\w+),\s*:(\w+)\)/
    );
    if (aggregateMatch) {
      const [, seriesName, frequency, operation] = aggregateMatch;
      return `Aggregated as ${operation} from ${seriesName}`;
    }

    // Handle interpolation: "SERIES@GEO.FREQ".ts.fill_missing_months_linear
    const interpolateMatch = evalExpr.match(
      /^"([^"]+)"\.ts\.fill_missing_months_linear/
    );
    if (interpolateMatch) {
      const [, seriesName] = interpolateMatch;
      return `Interpolated from ${seriesName}`;
    }

    // Handle file loading: "SERIES@GEO.FREQ".tsn.load_from("path")
    const loadFromMatch = evalExpr.match(
      /^"([^"]+)"\.tsn?\.load_from\("([^"]+)"\)/
    );
    if (loadFromMatch) {
      const [_, seriesName, filePath] = loadFromMatch;
      return `loaded from static file <${filePath}>`;
    }

    // Handle API loading: Series.load_api_bls_NEW("ID", "FREQ")
    const apiMatch = evalExpr.match(
      /Series\.load_api_(\w+)(?:_NEW)?\("([^"]+)",\s*"([^"]+)"\)/
    );
    if (apiMatch) {
      const [, source, id, freq] = apiMatch;
      return `loaded data set from ${source.toUpperCase()} API with parameters shown`;
    }

    // Handle arithmetic: "SERIES1@GEO.FREQ".ts * number
    const multiplyMatch = evalExpr.match(/^"([^"]+)"\.ts\s*\*\s*([\d.]+)/);
    if (multiplyMatch) {
      const [, seriesName, multiplier] = multiplyMatch;
      return `${seriesName} * ${multiplier}`;
    }

    // Handle division: ("SERIES1@GEO.FREQ".ts) / ("SERIES2@GEO.FREQ".ts) * 100
    const divisionMatch = evalExpr.match(
      /\(\("([^"]+)"\.ts\)\s*\/\s*\("([^"]+)"\.ts\)\)\s*\*\s*([\d.]+)/
    );
    if (divisionMatch) {
      const [, numerator, denominator, multiplier] = divisionMatch;
      return `((${numerator}) / (${denominator})) * ${multiplier}`;
    }

    // Handle simple series reference: "SERIES@GEO.FREQ".ts
    const simpleMatch = evalExpr.match(/^"([^"]+)"\.ts$/);
    if (simpleMatch) {
      const [, seriesName] = simpleMatch;
      return seriesName;
    }

    // Fallback: return the eval expression itself (cleaned up)
    return evalExpr.replace(/"/g, "").replace(/\.ts/g, "");
  }

  /** from Rails app: DataSource.reload_source */
  static reload({
    seriesId,
    clearFirst,
  }: {
    seriesId: number;
    clearFirst: boolean;
  }) {
    const series = Series.getSeriesMetadata({ id: seriesId });
    app.log.info(
      `Begin reload of definition ${seriesId} for series <#{self.series}> [#{description}]`
    );
    const time = new Date();
    const props = {
      lastRun: time,
      lastRunAt: time,
      lastError: null,
      lastErrorAt: null,
      runtime: null,
    };
  }
}

/** Dependency field in database is a serialized Ruby array which I guess looks like Yaml.
 * todo: change this field in the db to JSON */
function _parseDependencyField(yamlString: string): string[] {
  if (
    !yamlString ||
    yamlString.trim() === "---" ||
    yamlString.includes("--- []")
  ) {
    return [];
  }

  // Simple parser for YAML array format: "---\n- SERIES_NAME\n- SERIES_NAME2"
  const lines = yamlString.split("\n");
  const dependencies: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      dependencies.push(trimmed.substring(2).trim());
    }
  }

  return dependencies;
}
