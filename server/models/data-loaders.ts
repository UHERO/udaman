import { MySQLPromisePool } from "@fastify/mysql";
import { DataLoaderType, SourceMapNode } from "@shared/types/shared";
import { queryDB } from "helpers/sql";

/** Called data_sources in the database. Goal is to change it to data_loaders to
 * be less ambiguous, and not overlap with the source and source detail tables.
 */
export class DataLoaders {
  static async getSeriesLoaders(
    db: MySQLPromisePool,
    { seriesId }: { seriesId: number }
  ): Promise<DataLoaderType[]> {
    const query = db.format(
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

    const response = await queryDB(db, query);
    return response as DataLoaderType[];
  }

  static async getDataLoadersBySeriesId(
    db: MySQLPromisePool,
    { seriesId }: { seriesId: number }
  ): Promise<DataLoaderType[]> {
    const query = db.format(
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

    const response = await queryDB(db, query);
    return response as DataLoaderType[];
  }

  /** Iteratively fetches sources for use in series source map. Note that I attempted to move
   * this logic into a recursive SQL query, but it was very very slow for series with multiple
   * dependents. Implemented instead as a series of queries.
   */

  static async getDependencies(
    db: MySQLPromisePool,
    {
      seriesName,
      directOnly = false,
    }: { seriesName: string; directOnly?: boolean }
  ): Promise<SourceMapNode[]> {
    const seen = new Set<string>();

    async function buildNodes(
      name: string,
      level: number
    ): Promise<SourceMapNode[]> {
      if (seen.has(name)) {
        return []; // Avoid infinite loops
      }
      seen.add(name);

      const query = db.format(
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

      const results = await queryDB(db, query);

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
