import { MySQLPromisePool } from "@fastify/mysql";
import {
  DataLoaderType,
  SeriesDependency,
  SourceMapNode,
} from "@shared/types/shared";
import { isValidSeriesName } from "@shared/utils";
import { queryDB } from "helpers/sql";

import Series from "./series";

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

  static async buildSourceMap(
    db: MySQLPromisePool,
    {
      seriesId,
      depth = 5,
      seen = new Set(),
      colors = [
        "FFCC99",
        "CCFFFF",
        "99CCFF",
        "CC99FF",
        "FFFF99",
        "CCFFCC",
        "FF99CC",
        "CCCCFF",
        "9999FF",
        "99FFCC",
      ],
    }: {
      seriesId: number;
      depth?: number;
      seen?: Set<string>;
      colors?: string[];
    }
  ): Promise<SourceMapNode[]> {
    if (depth > 6) return [];

    const dataSources = await this.getDataLoadersBySeriesId(db, { seriesId });
    const sourceMapNodes: SourceMapNode[] = [];

    for (const dataSource of dataSources) {
      const dependencies: SeriesDependency[] = [];
      const children: SourceMapNode[] = [];

      if (dataSource.description) {
        const words = dataSource.description.split(/\s+/);

        for (const word of words) {
          if (isValidSeriesName(word) && !seen.has(word)) {
            seen.add(word);

            const series = await Series.getSeriesByName(db, word);
            if (series) {
              dependencies.push(series);

              // Recursively get children
              const childNodes = await this.buildSourceMap(
                db,
                series.id,
                depth + 1,
                new Set(seen),
                [...colors]
              );
              children.push(...childNodes);
            }
          }
        }
      }

      const color = colors.shift() || "AAAAAA";

      sourceMapNodes.push({
        dataSource,
        dependencies,
        children,
        depth,
        color,
      });
    }

    return sourceMapNodes;
  }
}
