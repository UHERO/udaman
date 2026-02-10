import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Loader from "../models/loader";
import type { LoaderAttrs } from "../models/loader";
import type { Universe, SourceMapNode } from "../types/shared";
import type { CreateLoaderPayload } from "../types/sources";

interface DependencyRow {
  name: string;
  id: number;
  series_id: number;
  disabled: boolean;
  universe: string;
  color: string;
  last_run_at: Date | null;
  last_run_in_seconds: number | null;
  last_error: string | null;
  last_error_at: Date | null;
  dependencies: string | null;
  description: string | null;
  aremos_missing: number | null;
  aremos_diff: number | null;
}

interface ColorUsageRow {
  color: string;
  usage_count: number;
}

export type UpdateLoaderPayload = {
  eval?: string | null;
  description?: string | null;
  priority?: number;
  scale?: string;
  disabled?: boolean;
  pseudoHistory?: boolean;
  clearBeforeLoad?: boolean;
  reloadNightly?: boolean;
  presaveHook?: string | null;
  color?: string | null;
  dependencies?: string | null;
};

class LoaderCollection {
  /** List all loaders, optionally filtered by universe */
  static async list(options: { universe?: Universe } = {}): Promise<Loader[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<LoaderAttrs>`
        SELECT * FROM data_sources WHERE universe = ${universe} ORDER BY priority ASC
      `;
      return rows.map((row) => new Loader(row));
    }
    const rows = await mysql<LoaderAttrs>`
      SELECT * FROM data_sources ORDER BY priority ASC
    `;
    return rows.map((row) => new Loader(row));
  }

  /** Fetch a single loader by ID */
  static async getById(id: number): Promise<Loader> {
    const rows = await mysql<LoaderAttrs>`
      SELECT * FROM data_sources WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Loader not found: ${id}`);
    return new Loader(row);
  }

  /** Fetch all loaders for a series */
  static async getBySeriesId(seriesId: number): Promise<Loader[]> {
    const rows = await mysql<LoaderAttrs>`
      SELECT
        id, series_id, disabled, universe, priority,
        created_at, updated_at, reload_nightly, pseudo_history,
        clear_before_load, eval, scale, presave_hook, color,
        runtime, last_run_at, last_run_in_seconds, last_error,
        last_error_at, dependencies, description
      FROM data_sources
      WHERE series_id = ${seriesId}
    `;
    return rows.map((row) => new Loader(row));
  }

  /** Fetch enabled loaders for a series, ordered by priority */
  static async getEnabledBySeriesId(seriesId: number): Promise<Loader[]> {
    const rows = await mysql<LoaderAttrs>`
      SELECT
        id, description, last_run_in_seconds, priority,
        disabled, eval, dependencies
      FROM data_sources
      WHERE series_id = ${seriesId}
        AND disabled = 0
      ORDER BY priority ASC, last_run_in_seconds DESC
    `;
    return rows.map((row) => new Loader(row));
  }

  /** Create a new loader */
  static async create(payload: CreateLoaderPayload): Promise<Loader> {
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

    const loaderType = Loader.getLoaderType(code, pseudoHistory);
    const colorPalette = Loader.getColorPalette(loaderType);
    const description = Loader.generateDescriptionFromEval(code);
    const optimalColor = await this.calculateColor(
      seriesId,
      loaderType,
      colorPalette
    );
    const dependencies = Loader.extractDependencies(description || "", code);

    await mysql`
      INSERT INTO data_sources (
        series_id, eval, priority, scale, presave_hook,
        clear_before_load, pseudo_history, universe, disabled,
        reload_nightly, color, dependencies,
        created_at, updated_at
      ) VALUES (
        ${seriesId},
        ${code},
        ${priority || 50},
        ${scale || "1.0"},
        ${presaveHook},
        ${clearBeforeLoad},
        ${pseudoHistory},
        ${universe},
        ${false},
        ${true},
        ${optimalColor},
        ${JSON.stringify(dependencies)},
        NOW(),
        NOW()
      )
    `;

    const [{ insertId }] = await mysql<{ insertId: number }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a loader */
  static async update(id: number, updates: UpdateLoaderPayload): Promise<Loader> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE data_sources
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a loader and its associated data points */
  static async delete(id: number): Promise<void> {
    const loader = await this.getById(id);
    if (loader.seriesId) {
      await mysql`
        DELETE FROM data_points
        WHERE series_id = ${loader.seriesId} AND data_source_id = ${id}
      `;
    }
    await mysql`DELETE FROM data_sources WHERE id = ${id}`;
  }

  /** Disable a loader */
  static async disable(id: number): Promise<Loader> {
    return this.update(id, { disabled: true });
  }

  /** Toggle nightly reload flag */
  static async toggleReloadNightly(id: number): Promise<Loader> {
    const loader = await this.getById(id);
    return this.update(id, { reloadNightly: !loader.reloadNightly });
  }

  /** Iteratively fetch sources for use in series source map.
   * Note: recursive SQL was very slow for series with multiple dependents,
   * so this is implemented as a series of queries.
   */
  static async getDependencyTree(
    seriesName: string,
    options: { directOnly?: boolean } = {}
  ): Promise<SourceMapNode[]> {
    const { directOnly = false } = options;
    const seen = new Set<string>();

    async function buildNodes(
      name: string,
      level: number
    ): Promise<SourceMapNode[]> {
      if (seen.has(name)) return [];
      seen.add(name);

      const results = await mysql<DependencyRow>`
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
        WHERE s.name = ${name}
          AND ds.universe = 'UHERO'
          AND ds.disabled = 0
      `;

      if (results.length === 0) return [];

      const nodes: SourceMapNode[] = [];

      for (const r of results) {
        const children: SourceMapNode[] = [];
        if (r.dependencies) {
          const deps = Loader.parseDependencies(r.dependencies);
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
            id: r.id,
            series_id: r.series_id,
            disabled: !!r.disabled,
            universe: r.universe,
            color: r.color,
            last_run_at: r.last_run_at,
            last_run_in_seconds: r.last_run_in_seconds as unknown as import("@prisma/client/runtime/library").Decimal | null,
            last_error: r.last_error,
            dependencies: r.dependencies,
            description: r.description,
            aremos_missing: r.aremos_missing,
            aremos_diff: r.aremos_diff,
          },
        });
      }

      return nodes;
    }

    return buildNodes(seriesName, 0);
  }

  /** Calculate the optimal color for a new loader based on existing usage */
  static async calculateColor(
    seriesId: number,
    loaderType: string,
    palette: string[]
  ): Promise<string> {
    const existing = await mysql<ColorUsageRow>`
      SELECT ds.color, COUNT(*) as usage_count
      FROM data_sources ds
      WHERE ds.series_id = ${seriesId}
        AND ds.disabled = 0
        AND (
          (${loaderType} = 'pseudo_history' AND ds.pseudo_history = 1) OR
          (${loaderType} != 'pseudo_history' AND ds.pseudo_history = 0 AND
           CASE
             WHEN ds.eval REGEXP 'load_api' THEN 'api'
             WHEN ds.eval REGEXP 'forecast' THEN 'forecast'
             WHEN ds.eval REGEXP 'load_from_download' THEN 'download'
             WHEN ds.eval REGEXP 'load_[a-z_]*from.*history' THEN 'history'
             WHEN ds.eval REGEXP 'load_[a-z_]*from' THEN 'manual'
             ELSE 'other'
           END = ${loaderType})
        )
      GROUP BY ds.color
    `;

    const usageMap: Record<string, number> = {};
    existing.forEach((row) => {
      if (palette.includes(row.color)) {
        usageMap[row.color] = row.usage_count;
      }
    });

    let optimalColor = palette[0];
    let minUsage = (optimalColor && usageMap[optimalColor]) || 0;

    for (const color of palette) {
      const usage = usageMap[color] || 0;
      if (usage < minUsage) {
        optimalColor = color;
        minUsage = usage;
      }
    }

    return optimalColor;
  }
}

export default LoaderCollection;
