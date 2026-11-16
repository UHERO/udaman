/** Catalog MCP: loaders. Read a loader, check and dry-run load statements. */

import "server-only";

import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import { isoDate } from "@catalog/utils/time";
import { mysql } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { dryRunLoad, type DryRunResult } from "@/core/ops/dry-run";
import { agentEvalRefusal } from "@/core/ops/rules";

import { UNIVERSE as U, wrap, type CallerContext } from "../shared";

const HIDDEN = "(restricted series: values hidden)";

async function isRestrictedSeries(seriesId: number | null): Promise<boolean> {
  if (!seriesId) return false;
  const rows = await mysql<{ restricted: number | boolean | null }>`
    SELECT x.restricted FROM series s JOIN xseries x ON x.id = s.xseries_id
    WHERE s.id = ${seriesId} LIMIT 1
  `;
  return Boolean(rows[0]?.restricted);
}

/** Dry-run result without data values (counts and dates stay). */
function withoutValues(r: DryRunResult) {
  return { ...r, maxRelativeChange: null, samples: HIDDEN };
}

async function loaderDetail(id: number, hideRestricted: boolean) {
  const loader = await LoaderCollection.getById(id);
  const hide = hideRestricted && (await isRestrictedSeries(loader.seriesId));
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
      value: hide ? HIDDEN : p.value,
    })),
    history: actions,
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
    wrap(async ({ id }: { id: number }) => loaderDetail(id, ctx.isAgent)),
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
        const result = await dryRunLoad({
          loaderId: a.loader_id,
          seriesId: a.series_id,
          eval: a.eval,
          scale: a.scale,
        });
        if (!ctx.isAgent) return result;
        const seriesId =
          a.series_id ??
          (a.loader_id
            ? (await LoaderCollection.getById(a.loader_id)).seriesId
            : null);
        return (await isRestrictedSeries(seriesId))
          ? withoutValues(result)
          : result;
      },
    ),
  );
}
