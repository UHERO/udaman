/** Catalog MCP: loaders. Read a loader, check and dry-run load statements. */

import "server-only";

import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import { isoDate } from "@catalog/utils/time";
import { mysql, rawQuery } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { dryRunLoad } from "@/core/ops/dry-run";
import { agentEvalRefusal } from "@/core/ops/rules";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

async function loaderDetail(id: number) {
  const loader = await LoaderCollection.getById(id);
  const series = loader.seriesId
    ? (
        await mysql<{
          name: string;
          xseries_id: number;
        }>`SELECT name, xseries_id FROM series WHERE id = ${loader.seriesId}`
      )[0]
    : undefined;
  const points = series
    ? await mysql<{ date: Date | string; value: number | null }>`
        SELECT date, value FROM data_points
        WHERE xseries_id = ${series.xseries_id} AND data_source_id = ${id} AND current = 1
        ORDER BY date DESC LIMIT 6`
    : [];
  const pointCount = series
    ? (
        await mysql<{
          n: number;
        }>`SELECT COUNT(*) AS n FROM data_points WHERE xseries_id = ${series.xseries_id} AND data_source_id = ${id} AND current = 1`
      )[0]?.n
    : 0;
  const actions = loader.seriesId
    ? (await LoaderActionCollection.getBySeriesId(loader.seriesId))
        .filter((a) => a.loaderId === id)
        .slice(0, 15)
    : [];
  return {
    loader: loader.toJSON(),
    seriesName: series?.name ?? null,
    currentPointCount: Number(pointCount ?? 0),
    newestPoints: points.map((p) => ({
      date: isoDate(p.date),
      value: p.value,
    })),
    history: actions,
  };
}

interface DataPointRow {
  date: string;
  data_source_id: number;
  current: number | boolean | null;
  value: number | string | null;
  change: number | string | null;
  yoy: number | string | null;
  ytd: number | string | null;
  pseudo_history: number | null;
  history: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Every column of `data_points` for one series, optionally narrowed to one
 * loader. Includes superseded rows (current = 0) unless asked not to, since
 * the vintages are what show when and by which loader a value changed.
 * Timestamps are formatted in SQL, so they stay HST wall-clock strings.
 */
async function dataPoints(a: {
  loader_id?: number;
  series_id?: number;
  date_from?: string;
  date_to?: string;
  current_only?: boolean;
  newest_first?: boolean;
  limit?: number;
}) {
  if (!a.loader_id && !a.series_id) {
    throw new Error("Give loader_id or series_id");
  }
  let seriesId = a.series_id ?? null;
  if (a.loader_id) {
    const loader = await LoaderCollection.getById(a.loader_id);
    if (seriesId && loader.seriesId !== seriesId) {
      throw new Error(
        `Loader ${a.loader_id} belongs to series ${loader.seriesId}, not ${seriesId}`,
      );
    }
    seriesId = loader.seriesId;
  }
  if (!seriesId) throw new Error("That loader has no series");
  const series = (
    await mysql<{ name: string; xseries_id: number }>`
      SELECT name, xseries_id FROM series
      WHERE id = ${seriesId} AND universe = ${U} LIMIT 1`
  )[0];
  if (!series) throw new Error(`No ${U} series with id ${seriesId}`);

  const where = ["xseries_id = ?"];
  const params: (string | number)[] = [series.xseries_id];
  if (a.loader_id) {
    where.push("data_source_id = ?");
    params.push(a.loader_id);
  }
  if (a.date_from) {
    where.push("date >= ?");
    params.push(a.date_from);
  }
  if (a.date_to) {
    where.push("date <= ?");
    params.push(a.date_to);
  }
  if (a.current_only) where.push("current = 1");
  const limit = Math.min(Math.max(a.limit ?? 200, 1), 1000);
  const dir = a.newest_first === false ? "ASC" : "DESC";
  const whereSql = where.join(" AND ");

  const total = (
    await rawQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM data_points WHERE ${whereSql}`,
      params,
    )
  )[0]?.n;
  const rows = await rawQuery<DataPointRow>(
    `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, data_source_id, current,
            value, \`change\`, yoy, ytd, pseudo_history,
            DATE_FORMAT(history, '%Y-%m-%d %H:%i:%s') AS history,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM data_points WHERE ${whereSql}
     ORDER BY date ${dir}, created_at ${dir} LIMIT ${limit}`,
    params,
  );

  return {
    seriesId,
    seriesName: series.name,
    xseriesId: series.xseries_id,
    loaderId: a.loader_id ?? null,
    matching: Number(total ?? 0),
    returned: rows.length,
    note: "Timestamps are Hawaii time. current = 1 is the value in use; other rows are superseded vintages.",
    points: rows.map((r) => ({
      date: r.date,
      dataSourceId: r.data_source_id,
      current: Boolean(r.current),
      value: r.value,
      change: r.change,
      yoy: r.yoy,
      ytd: r.ytd,
      pseudoHistory: Boolean(r.pseudo_history),
      history: r.history,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export function registerLoaderTools(server: McpServer, ctx: CallerContext) {
  server.registerTool(
    "get_loader",
    {
      title: "Get a loader",
      description:
        "A loader (data_sources row): its load statement (eval), settings, last run and error, newest data points, and its change history (loader actions).",
      inputSchema: { id: z.number().int() },
    },
    wrap(async ({ id }: { id: number }) => loaderDetail(id)),
  );

  server.registerTool(
    "get_data_points",
    {
      title: "Data points for a loader or series",
      description:
        "Rows of the data_points table with every column: date, value, which loader wrote it (dataSourceId), whether it is the current value, change/yoy/ytd, pseudoHistory, history, createdAt and updatedAt. " +
        "Give loader_id for the points one loader wrote, or series_id for the points from all of a series' loaders (to see which loader supplies each date). " +
        "Superseded vintages are included unless current_only is true. Newest dates first; default 200 rows, at most 1000. Narrow with date_from / date_to (YYYY-MM-DD).",
      inputSchema: {
        loader_id: z.number().int().optional(),
        series_id: z.number().int().optional(),
        date_from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        date_to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        current_only: z.boolean().optional(),
        newest_first: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      },
    },
    wrap(async (a: Parameters<typeof dataPoints>[0]) => dataPoints(a)),
  );

  server.registerTool(
    "get_reload_jobs",
    {
      title: "Recent reload jobs",
      description:
        "Recent reload jobs in UHERO with status, error and series names (the /investigations dashboard list).",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    wrap(async ({ limit }: { limit?: number }) =>
      ReloadJobCollection.listRecent(U, limit ?? 30),
    ),
  );

  server.registerTool(
    "check_eval",
    {
      title: "Check a load statement",
      description:
        "Parse and resolve a load statement for a series without running it. Returns warnings, or an error if it can't resolve.",
      inputSchema: { eval: z.string().min(1), series_id: z.number().int() },
    },
    wrap(async (a: { eval: string; series_id: number }) => ({
      ok: true,
      warnings: await LoaderCollection.checkEval(a.eval, a.series_id),
    })),
  );

  server.registerTool(
    "dry_run_loader",
    {
      title: "Dry-run a load statement",
      description:
        "Evaluate a load statement in memory and diff it against the current data points; nothing is written. " +
        "Give loader_id (optionally with a new eval) to test a fix, or series_id + eval for a proposed new loader. " +
        "Always dry-run a load-statement change before proposing it.",
      inputSchema: {
        loader_id: z.number().int().optional(),
        series_id: z.number().int().optional(),
        eval: z.string().optional(),
        scale: z.number().optional(),
      },
    },
    wrap(
      async (a: {
        loader_id?: number;
        series_id?: number;
        eval?: string;
        scale?: number;
      }) => {
        // Only devs may dry-run a statement naming arbitrary file paths.
        if (!ctx.isDev && a.eval) {
          const refusal = agentEvalRefusal(a.eval);
          if (refusal) throw new Error(refusal);
        }
        return dryRunLoad({
          loaderId: a.loader_id,
          seriesId: a.series_id,
          eval: a.eval,
          scale: a.scale,
        });
      },
    ),
  );
}
