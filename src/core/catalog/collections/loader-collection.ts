import { createLogger } from "@/core/observability/logger";
import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Loader from "../models/loader";
import type { LoaderAttrs } from "../models/loader";
import type { SourceMapNode, Universe } from "../types/shared";
import type { CreateLoaderPayload } from "../types/sources";
import EvalExecutor from "../utils/eval-executor";
import SeriesCollection from "./series-collection";

const log = createLogger("catalog.loader-collection");

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
  lastRunAt?: Date | null;
  lastRunInSeconds?: number | null;
  lastError?: string | null;
  lastErrorAt?: Date | null;
  runtime?: number | null;
};

export type ReloadResult = {
  status: "success" | "skipped" | "error";
  message: string;
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
      colorPalette,
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

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a loader */
  static async update(
    id: number,
    updates: UpdateLoaderPayload,
  ): Promise<Loader> {
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

  /** Disable a loader: delete its data points and clear errors */
  static async disable(id: number): Promise<Loader> {
    const loader = await this.getById(id);
    await this.deleteDataPoints(loader);
    return this.update(id, {
      disabled: true,
      lastError: null,
      lastErrorAt: null,
    });
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
    options: { directOnly?: boolean } = {},
  ): Promise<SourceMapNode[]> {
    const { directOnly = false } = options;
    const seen = new Set<string>();

    async function buildNodes(
      name: string,
      level: number,
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
            universe: r.universe as Universe,
            color: r.color,
            last_run_at: r.last_run_at,
            last_run_in_seconds: r.last_run_in_seconds,
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
    palette: string[],
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
  /** Adapted from DataSource.reload_source */
  static async reload({
    loader,
    clearFirst,
  }: {
    loader: Loader;
    clearFirst: boolean;
  }): Promise<ReloadResult> {
    if (loader.disabled)
      return { status: "skipped", message: "Loader is disabled" };
    if (!loader.eval)
      return { status: "skipped", message: "Loader has no eval expression" };

    log.info(
      { series: loader.seriesId },
      `Begin reload of definition ${loader.id} for series ${loader.seriesId}. [${loader.description}]`,
    );

    const t = new Date();
    const updateProps: UpdateLoaderPayload = {
      lastRunAt: t,
      lastError: null,
      lastErrorAt: null,
      runtime: null,
    };

    try {
      if (clearFirst || loader.clearBeforeLoad) {
        await this.deleteDataPoints(loader);
      }

      const result = await EvalExecutor.run(loader.eval);

      // TODO: apply presave_hook if set (requires porting hook dispatch)

      // Apply scale and write data points
      if (loader.seriesId) {
        const scaledData = result.scaledData(parseFloat(loader.scale));

        const xseriesRows = await mysql<{ xseries_id: number }>`
          SELECT xseries_id FROM series WHERE id = ${loader.seriesId} LIMIT 1
        `;
        const xseriesId = xseriesRows[0]?.xseries_id;

        if (xseriesId) {
          await SeriesCollection.updateData({
            xseriesId,
            data: scaledData,
            dataSourceId: loader.id,
            pseudoHistory: loader.pseudoHistory,
          });

          // Check for base_year change from rebase
          const baseYear = loader.baseYearFromEval();
          if (baseYear) {
            await mysql`
              UPDATE xseries
              SET base_year = ${baseYear}
              WHERE id = ${xseriesId}
                AND (base_year IS NULL OR base_year != ${baseYear})
            `;
          }
        }
      }

      const runtime = (Date.now() - t.getTime()) / 1000;
      updateProps.description = result.name ?? loader.description;
      updateProps.runtime = runtime;

      log.info(
        { series: loader.seriesId, runtime },
        `Completed reload of definition ${loader.id}`,
      );
      return { status: "success", message: `Loaded in ${runtime.toFixed(1)}s` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(
        { series: loader.seriesId, err: message },
        `Reload failed for definition ${loader.id}`,
      );
      updateProps.lastError = message.slice(0, 254);
      updateProps.lastErrorAt = t;
      return { status: "error", message };
    } finally {
      await this.update(loader.id, updateProps);
    }
  }

  /** Delete data points for a loader, with optional date filters */
  static async deleteDataPoints(
    loader: Loader,
    opts?: { dateFrom?: string; createFrom?: string },
  ): Promise<void> {
    if (opts?.dateFrom && opts?.createFrom) {
      await mysql`
        DELETE FROM data_points
        WHERE data_source_id = ${loader.id}
          AND date >= ${opts.dateFrom}
          AND created_at >= ${opts.createFrom}
      `;
    } else if (opts?.dateFrom) {
      await mysql`
        DELETE FROM data_points
        WHERE data_source_id = ${loader.id}
          AND date >= ${opts.dateFrom}
      `;
    } else if (opts?.createFrom) {
      await mysql`
        DELETE FROM data_points
        WHERE data_source_id = ${loader.id}
          AND created_at >= ${opts.createFrom}
      `;
    } else {
      await mysql`
        DELETE FROM data_points
        WHERE data_source_id = ${loader.id}
      `;
    }
    log.info(
      { loaderId: loader.id },
      `Deleted data points for loader ${loader.id}`,
    );
  }

  /** Update dependencies for all UHERO loaders */
  static async setAllDependencies(): Promise<void> {
    log.info("setAllDependencies: start");
    const loaders = await this.list({ universe: "UHERO" });
    for (const loader of loaders) {
      log.debug(`setAllDependencies: for ${loader.description}`);
      loader.refreshDependencies();
      await this.update(loader.id, {
        dependencies: JSON.stringify(loader.dependencies),
      });
    }
    log.info("setAllDependencies: done");
  }

  /** Get current (active) data points for a series */
  static async getCurrentDataPoints(
    xseriesId: number,
  ): Promise<Array<{ date: Date; value: number; dataSourceId: number }>> {
    const rows = await mysql<{
      date: Date;
      value: number;
      data_source_id: number;
    }>`
      SELECT date, value, data_source_id
      FROM data_points
      WHERE xseries_id = ${xseriesId} AND current = 1
      ORDER BY date
    `;
    return rows.map((r) => ({
      date: r.date,
      value: r.value,
      dataSourceId: r.data_source_id,
    }));
  }

  /** Get other enabled loaders for the same series (excluding the given one) */
  static async getColleagues(loader: Loader): Promise<Loader[]> {
    if (!loader.seriesId) return [];
    const enabled = await this.getEnabledBySeriesId(loader.seriesId);
    return enabled.filter((l) => l.id !== loader.id);
  }

  /** Persist color for a loader (computes optimal color if none provided) */
  static async setColor(id: number, color?: string): Promise<Loader> {
    if (!color) {
      const loader = await this.getById(id);
      const palette = Loader.getColorPalette(loader.loaderType);
      color = await this.calculateColor(
        loader.seriesId!,
        loader.loaderType,
        palette,
      );
    }
    return this.update(id, { color });
  }

  /** Persist recomputed dependencies for a loader */
  static async setDependencies(id: number): Promise<Loader> {
    const loader = await this.getById(id);
    loader.refreshDependencies();
    return this.update(id, {
      dependencies: JSON.stringify(loader.dependencies),
    });
  }

  /** Run setup for a newly created loader (set color + dependencies) */
  static async setup(id: number): Promise<Loader> {
    await this.setColor(id);
    return this.setDependencies(id);
  }

  /** Set reload_nightly to a specific value */
  static async setReloadNightly(id: number, value: boolean): Promise<Loader> {
    return this.update(id, { reloadNightly: value });
  }

  /** Reset a loader's error state */
  static async reset(id: number): Promise<Loader> {
    // TODO: reset data_source_downloads when that model is ported
    return this.update(id, { lastError: null, lastErrorAt: null });
  }

  /** Mark all data points for a loader as pseudo_history */
  static async markDataAsPseudoHistory(
    id: number,
    value = true,
  ): Promise<void> {
    await mysql`
      UPDATE data_points
      SET pseudo_history = ${value ? 1 : 0}
      WHERE data_source_id = ${id}
    `;
  }

  /** Check if a loader has any current data points */
  static async isCurrent(id: number, seriesId: number): Promise<boolean> {
    const rows = await mysql<{ found: number }>`
      SELECT 1 as found
      FROM data_points
      WHERE data_source_id = ${id}
        AND xseries_id = (SELECT xseries_id FROM series WHERE id = ${seriesId} LIMIT 1)
        AND current = 1
      LIMIT 1
    `;
    return rows.length > 0;
  }

  /** Get summary of load errors grouped by error message */
  static async getLoadErrorSummary(): Promise<
    Array<{ lastError: string; seriesId: number; count: number }>
  > {
    const rows = await mysql<{
      last_error: string;
      series_id: number;
      error_count: number;
    }>`
      SELECT last_error, series_id, COUNT(*) as error_count
      FROM data_sources
      WHERE universe = 'UHERO'
        AND disabled = 0
        AND last_error IS NOT NULL
      GROUP BY last_error, series_id
      ORDER BY error_count DESC, last_error
    `;
    return rows.map((r) => ({
      lastError: r.last_error,
      seriesId: r.series_id,
      count: r.error_count,
    }));
  }
}

export default LoaderCollection;
