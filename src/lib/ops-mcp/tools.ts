/*************************************************************************
 * Internal ops MCP tools (/api/mcp/ops). Used by the ops agent and by
 * staff from their own Claude Code. Which tools exist depends on the
 * caller (see registerOpsTools); a tool that isn't registered can't be
 * called, whatever the model asks for.
 *
 *   everyone (internal+)  read tools, issue tools
 *   agent                 + propose_change, run_* (runner bookkeeping)
 *   reviewers             + review_proposal
 *   dev / admin           + dismiss, direct edits, reloads
 *
 * The agent never sees data values of restricted series, and a load
 * statement it supplies can't read files outside the data directory.
 *
 * Never exposed: deletes, clearing data points, admin actions, raw SQL,
 * hhdb, users/permissions.
 *************************************************************************/

import "server-only";

import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import { isoDate } from "@catalog/utils/time";
import { mysql, rawQuery } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  applyLoaderUpdate,
  applyMeasurementMetadata,
  applySeriesMetadata,
  currentLoaderState,
  requestReload,
} from "@/core/ops/changes";
import { dryRunLoad, type DryRunResult } from "@/core/ops/dry-run";
import { IssueStore } from "@/core/ops/issue-store";
import {
  assignIssue,
  commentOnIssue,
  dismissIssue,
  raiseFinding,
  reopenIssue,
  resolveIssue,
  snoozeIssue,
} from "@/core/ops/issues";
import { issueUrl } from "@/core/ops/links";
import { ProposalStore } from "@/core/ops/proposal-store";
import { createProposal, reviewProposal } from "@/core/ops/proposals";
import { agentEvalRefusal } from "@/core/ops/rules";
import {
  addRunUsage,
  claimWork,
  finishRun,
  getBudget,
  getWork,
  logSteps,
  recordPoll,
  startRun,
} from "@/core/ops/runs";
import { getOpsSettings } from "@/core/ops/settings";
import type { Actor, IssueKind, IssueStatus } from "@/core/ops/types";

/** v1 scope: the UHERO universe only. */
export const OPS_UNIVERSE = "UHERO";

export interface OpsToolContext {
  actor: Actor;
  isAgent: boolean;
  isDev: boolean;
  /** Devs, admins, and people on the reviewer list. */
  canReview: boolean;
  /** False in comment-only mode: the agent gets no propose_change tool. */
  agentCanPropose: boolean;
}

function ok(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 1) },
    ],
  };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
  };
}

/** Wrap a handler: errors become tool errors, never thrown. */
function wrap<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (e) {
      return fail(e);
    }
  };
}

// ─── Source probing ───────────────────────────────────────────────────

const DEFAULT_PROBE_DOMAINS = [
  "bls.gov",
  "bea.gov",
  "census.gov",
  "stlouisfed.org",
  "hawaii.gov",
  "uhero.hawaii.edu",
  "hawaiitourismauthority.org",
  "statcan.gc.ca",
  "eia.gov",
  "usda.gov",
  "dol.gov",
  "federalreserve.gov",
  "hud.gov",
  "huduser.gov",
  "fred.stlouisfed.org",
];

function probeAllowed(url: URL): boolean {
  const domains = (
    process.env.OPS_PROBE_DOMAINS?.split(",") ?? DEFAULT_PROBE_DOMAINS
  )
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const host = url.hostname.toLowerCase();
  return (
    ["http:", "https:"].includes(url.protocol) &&
    domains.some((d) => host === d || host.endsWith(`.${d}`))
  );
}

async function probeUrl(raw: string) {
  const url = new URL(raw);
  if (!probeAllowed(url)) {
    throw new Error(
      `Domain ${url.hostname} is not on the probe allowlist (OPS_PROBE_DOMAINS)`,
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "udaman-ops-probe" },
    });
    const finalUrl = new URL(res.url);
    if (!probeAllowed(finalUrl)) {
      return {
        status: res.status,
        redirectedTo: res.url,
        note: "redirected off the allowlist; body not read",
      };
    }
    const type = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    const isText = /text|json|xml|csv|html/.test(type);
    return {
      status: res.status,
      finalUrl: res.url,
      contentType: type,
      contentLength: buf.byteLength,
      lastModified: res.headers.get("last-modified"),
      etag: res.headers.get("etag"),
      head: isText
        ? new TextDecoder().decode(buf.slice(0, 6000))
        : `(binary, first bytes ${[...buf.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join(" ")})`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Read helpers ─────────────────────────────────────────────────────

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

async function seriesDetail(idOrName: string | number) {
  const rows =
    typeof idOrName === "number"
      ? await mysql`SELECT * FROM series WHERE id = ${idOrName} LIMIT 1`
      : await mysql`SELECT * FROM series WHERE name = ${idOrName} AND universe = ${OPS_UNIVERSE} LIMIT 1`;
  const s = rows[0];
  if (!s) throw new Error(`Series ${idOrName} not found`);
  const [source, detail, unit, geo] = await Promise.all([
    s.source_id
      ? mysql`SELECT id, description, link FROM sources WHERE id = ${s.source_id}`
      : Promise.resolve([]),
    s.source_detail_id
      ? mysql`SELECT id, description FROM source_details WHERE id = ${s.source_detail_id}`
      : Promise.resolve([]),
    s.unit_id
      ? mysql`SELECT id, short_label, long_label FROM units WHERE id = ${s.unit_id}`
      : Promise.resolve([]),
    s.geography_id
      ? mysql`SELECT id, handle, display_name FROM geographies WHERE id = ${s.geography_id}`
      : Promise.resolve([]),
  ]);
  const loaders = await LoaderCollection.getBySeriesId(Number(s.id));
  const prefix = String(s.name ?? "").split("@")[0];
  const siblings = prefix
    ? await mysql`
        SELECT id, name, dataPortalName, source_id, source_detail_id, unit_id,
               geography_id, source_link, LEFT(description, 200) AS description
        FROM series
        WHERE universe = ${s.universe} AND name LIKE ${`${prefix}@%`} AND id <> ${s.id}
        ORDER BY name LIMIT 25`
    : [];
  const measurements = await mysql`
    SELECT m.id, m.prefix, m.data_portal_name AS dataPortalName, m.source_id,
           m.unit_id, m.source_detail_id, m.source_link,
           EXISTS (SELECT 1 FROM data_list_measurements dlm
                   WHERE dlm.measurement_id = m.id) AS in_data_list
    FROM measurement_series ms JOIN measurements m ON m.id = ms.measurement_id
    WHERE ms.series_id = ${s.id}
  `;
  const dependents = await mysql`
    SELECT ds.id AS loader_id, se.name
    FROM data_sources ds JOIN series se ON se.id = ds.series_id
    WHERE ds.universe = ${s.universe} AND ds.disabled = 0
      AND ds.eval LIKE ${`%"${s.name}"%`}
    LIMIT 25
  `;
  return {
    series: {
      id: Number(s.id),
      name: s.name,
      universe: s.universe,
      dataPortalName: s.dataPortalName,
      description: s.description,
      source_link: s.source_link,
      source: source[0] ?? null,
      source_detail: detail[0] ?? null,
      unit: unit[0] ?? null,
      geography: geo[0] ?? null,
      investigation_notes: s.investigation_notes ?? null,
    },
    // The portal shows the series value, else the measurement's.
    measurements,
    loaders: loaders.map((l) => ({
      id: l.id,
      eval: l.eval,
      priority: l.priority,
      disabled: l.disabled,
      lastRunAt: l.lastRunAt,
      lastError: l.lastError,
    })),
    siblingsSameNamePrefix: siblings,
    usedByLoadersOf: dependents,
  };
}

async function measurementDetail(id: number) {
  const rows = await mysql`
    SELECT m.id, m.prefix, m.universe, m.data_portal_name AS dataPortalName,
           m.source_id, src.description AS source, m.unit_id,
           u.short_label AS unit_short, u.long_label AS unit_long,
           m.source_detail_id, sd.description AS source_detail, m.source_link,
           m.seasonal_adjustment, m.percent, m.real, m.notes
    FROM measurements m
    LEFT JOIN sources src ON src.id = m.source_id
    LEFT JOIN units u ON u.id = m.unit_id
    LEFT JOIN source_details sd ON sd.id = m.source_detail_id
    WHERE m.id = ${id} AND m.universe = ${OPS_UNIVERSE} LIMIT 1
  `;
  if (!rows[0]) throw new Error(`Measurement ${id} not found`);
  const [series, dataLists] = await Promise.all([
    mysql`
      SELECT s.id, s.name, s.dataPortalName, s.source_id,
             src.description AS source, s.unit_id, u.short_label AS unit,
             s.source_detail_id, s.source_link, s.seasonal_adjustment
      FROM measurement_series ms
      JOIN series s ON s.id = ms.series_id
      LEFT JOIN sources src ON src.id = s.source_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE ms.measurement_id = ${id}
      ORDER BY s.name LIMIT 300`,
    mysql`
      SELECT dl.id, dl.name FROM data_list_measurements dlm
      JOIN data_lists dl ON dl.id = dlm.data_list_id
      WHERE dlm.measurement_id = ${id}`,
  ]);
  return {
    measurement: rows[0],
    note: "The portal shows a series' own value and falls back to the measurement's. A series has a gap only when both are empty.",
    series,
    dataLists,
  };
}

const LOOKUPS = {
  sources: {
    table: "sources",
    cols: "id, description, link",
    search: "description",
  },
  source_details: {
    table: "source_details",
    cols: "id, description",
    search: "description",
  },
  units: {
    table: "units",
    cols: "id, short_label, long_label",
    search: "long_label",
  },
  geographies: {
    table: "geographies",
    cols: "id, handle, display_name",
    search: "display_name",
  },
} as const;

// ─── Registration ─────────────────────────────────────────────────────

const STATUS = z.enum([
  "open",
  "investigating",
  "awaiting_human",
  "resolving",
  "resolved",
  "closed",
  "dismissed",
]);
const KIND = z.enum([
  "load_error",
  "reload_job_failed",
  "missing_metadata",
  "quarantined",
  "loader_lag",
  "agent_finding",
]);

export function registerOpsTools(server: McpServer, ctx: OpsToolContext) {
  const { actor } = ctx;
  const U = OPS_UNIVERSE;

  // ── Issues: read ──
  server.registerTool(
    "list_issues",
    {
      title: "List ops issues",
      description:
        "List data-loading issues (load errors, loaders past their lag limit, failed reload jobs, missing metadata, findings). " +
        "Defaults to live issues. Each issue has a group_key: issues sharing it usually share a cause and a fix.",
      inputSchema: {
        status: z
          .array(STATUS)
          .optional()
          .describe("Default: open, investigating, awaiting_human, resolving"),
        kind: z.array(KIND).optional(),
        group_key: z.string().optional(),
        search: z.string().optional().describe("Substring of title or summary"),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    wrap(
      async (a: {
        status?: IssueStatus[];
        kind?: IssueKind[];
        group_key?: string;
        search?: string;
        limit?: number;
        offset?: number;
      }) => {
        const res = await IssueStore.list({
          universe: U,
          status: a.status ?? [
            "open",
            "investigating",
            "awaiting_human",
            "resolving",
          ],
          kind: a.kind,
          groupKey: a.group_key,
          search: a.search,
          limit: a.limit ?? 50,
          offset: a.offset,
        });
        return {
          total: res.total,
          issues: res.rows.map((i) => ({
            id: i.id,
            kind: i.kind,
            status: i.status,
            severity: i.severity,
            owner: i.owner,
            title: i.title,
            group_key: i.groupKey,
            subject: `${i.subjectType}:${i.subjectId}${i.subjectField ? `:${i.subjectField}` : ""}`,
            first_seen_at: i.firstSeenAt,
            url: issueUrl(U, i.id),
          })),
        };
      },
    ),
  );

  server.registerTool(
    "get_issue",
    {
      title: "Get an ops issue",
      description:
        "One issue with its full timeline (from Slack, the app, MCP and the agent), its proposals, and how many other issues share its group.",
      inputSchema: { id: z.number().int() },
    },
    wrap(async ({ id }: { id: number }) => {
      const issue = await IssueStore.getById(id);
      if (!issue) throw new Error(`Issue ${id} not found`);
      const [events, proposals, group] = await Promise.all([
        IssueStore.listEvents(id),
        ProposalStore.list({ universe: U, issueId: id, limit: 20 }),
        issue.groupKey
          ? IssueStore.list({
              universe: U,
              groupKey: issue.groupKey,
              status: ["open", "investigating", "awaiting_human", "resolving"],
              limit: 200,
            })
          : Promise.resolve({ rows: [], total: 0 }),
      ]);
      return {
        issue,
        url: issueUrl(U, id),
        events: events.map((e) => ({
          at: e.createdAt,
          type: e.type,
          actor:
            e.actorType === "user"
              ? (e.actorEmail ?? `user ${e.actorUserId}`)
              : e.actorType,
          via: e.via,
          body: e.body,
          payload: e.payload,
        })),
        proposals: proposals.map((p) => ({
          id: p.id,
          kind: p.kind,
          status: p.status,
          summary: p.summary,
          review_note: p.reviewNote,
          targets: p.targets.length,
        })),
        group: { total: group.total, issue_ids: group.rows.map((r) => r.id) },
      };
    }),
  );

  // ── Catalog: read ──
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
    "get_series",
    {
      title: "Get a series",
      description:
        "Series metadata (source, source detail, unit, geography, portal name, description, link), the measurements it belongs to with their own metadata, its loaders, sibling series with the same name prefix, and loaders that reference it.",
      inputSchema: {
        id: z.number().int().optional(),
        name: z.string().optional().describe("Series name like VISNS@HI.M"),
      },
    },
    wrap(async ({ id, name }: { id?: number; name?: string }) => {
      if (id == null && !name) throw new Error("Give id or name");
      return seriesDetail(id ?? name!);
    }),
  );

  server.registerTool(
    "get_measurement",
    {
      title: "Get a measurement",
      description:
        "A measurement's own metadata (source, unit, source detail, portal name, link), every series in it with that series' own metadata, and the data lists it is in. Use it to decide whether a missing value belongs on the measurement (the series are the same measure) or on individual series (they legitimately differ).",
      inputSchema: { id: z.number().int() },
    },
    wrap(async ({ id }: { id: number }) => measurementDetail(id)),
  );

  server.registerTool(
    "find_series",
    {
      title: "Find series",
      description:
        "Search UHERO series by name pattern (SQL LIKE, e.g. 'VIS%@HI.M') or portal-name substring. Returns metadata ids so you can compare related series.",
      inputSchema: {
        name_like: z.string().optional(),
        portal_name_contains: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    wrap(
      async (a: {
        name_like?: string;
        portal_name_contains?: string;
        limit?: number;
      }) => {
        if (!a.name_like && !a.portal_name_contains)
          throw new Error("Give name_like or portal_name_contains");
        const where = ["universe = ?"];
        const params: (string | number)[] = [U];
        if (a.name_like) {
          where.push("name LIKE ?");
          params.push(a.name_like);
        }
        if (a.portal_name_contains) {
          where.push("dataPortalName LIKE ?");
          params.push(`%${a.portal_name_contains}%`);
        }
        return rawQuery(
          `SELECT id, name, dataPortalName, source_id, source_detail_id, unit_id, geography_id, source_link
         FROM series WHERE ${where.join(" AND ")} ORDER BY name LIMIT ${a.limit ?? 30}`,
          params,
        );
      },
    ),
  );

  server.registerTool(
    "list_lookup",
    {
      title: "List valid metadata values",
      description:
        "Rows of a lookup table (sources, source_details, units, geographies) in UHERO, optionally filtered by text. Use these ids in metadata proposals.",
      inputSchema: {
        table: z.enum(["sources", "source_details", "units", "geographies"]),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    wrap(
      async ({
        table,
        search,
        limit,
      }: {
        table: keyof typeof LOOKUPS;
        search?: string;
        limit?: number;
      }) => {
        const spec = LOOKUPS[table];
        const params: (string | number)[] = [U];
        let filter = "";
        if (search) {
          filter = ` AND ${spec.search} LIKE ?`;
          params.push(`%${search}%`);
        }
        return rawQuery(
          `SELECT ${spec.cols} FROM ${spec.table} WHERE universe = ?${filter} ORDER BY id LIMIT ${limit ?? 50}`,
          params,
        );
      },
    ),
  );

  server.registerTool(
    "get_app_logs",
    {
      title: "Read app logs",
      description:
        "Rows from app_logs (the database half of /admin/logs). Useful: category 'loader' + name 'loader.reload_error' with subject 'data_sources' + subject_id = loader id (full error detail and eval); category 'worker' (job results, err cut to 500 chars); name 'loader.batch_reload' (nightly batch summaries).",
      inputSchema: {
        category: z.string().optional(),
        name: z.string().optional(),
        subject: z.string().optional(),
        subject_id: z.number().int().optional(),
        level: z.enum(["info", "warn", "error"]).optional(),
        since_days: z.number().min(0.1).max(90).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    wrap(
      async (a: {
        category?: string;
        name?: string;
        subject?: string;
        subject_id?: number;
        level?: string;
        since_days?: number;
        limit?: number;
      }) => {
        const where = ["created_at >= NOW() - INTERVAL ? HOUR"];
        const params: (string | number)[] = [
          Math.round((a.since_days ?? 14) * 24),
        ];
        for (const [col, v] of [
          ["category", a.category],
          ["name", a.name],
          ["subject", a.subject],
          ["level", a.level],
        ] as const) {
          if (v) {
            where.push(`${col} = ?`);
            params.push(v);
          }
        }
        if (a.subject_id != null) {
          where.push("subject_id = ?");
          params.push(a.subject_id);
        }
        const rows = await rawQuery(
          `SELECT id, level, category, name, subject, subject_id, metadata, created_at
         FROM app_logs WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ${a.limit ?? 30}`,
          params,
        );
        return rows.map((r) => ({ ...r, id: String(r.id) }));
      },
    ),
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
        if (ctx.isAgent && a.eval) {
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

  server.registerTool(
    "probe_source_url",
    {
      title: "Probe a source URL",
      description:
        "Fetch a URL on the source-domain allowlist (bls.gov, bea.gov, hawaii.gov, …) and return status, final URL after redirects, headers and the first few KB. For checking whether a source file moved or changed format.",
      inputSchema: { url: z.string().url() },
    },
    wrap(async ({ url }: { url: string }) => probeUrl(url)),
  );

  // ── Issues: write ──
  server.registerTool(
    "comment_on_issue",
    {
      title: "Comment on an issue",
      description:
        "Add to an issue's timeline. kind='diagnosis' also sets the issue summary (use it for your conclusion about the cause). " +
        "kind='question' asks a person: it posts in Slack and hands the issue to a human until someone answers.",
      inputSchema: {
        id: z.number().int(),
        body: z.string().min(1).max(8000),
        kind: z.enum(["comment", "diagnosis", "question"]).optional(),
      },
    },
    wrap(
      async (a: {
        id: number;
        body: string;
        kind?: "comment" | "diagnosis" | "question";
      }) => {
        await commentOnIssue(a.id, actor, a.body, a.kind ?? "comment");
        return { ok: true };
      },
    ),
  );

  server.registerTool(
    "resolve_issue",
    {
      title: "Resolve an issue",
      description:
        "Ask for an issue to be resolved. The server re-checks the condition: resolved if it's gone; for a load error " +
        "that still shows its old error, a verification reload may be queued (state 'pending'); otherwise 'rejected'. " +
        "Use after fixing something yourself, or to confirm a fix someone made.",
      inputSchema: {
        id: z.number().int(),
        note: z.string().max(2000).optional(),
      },
    },
    wrap(async (a: { id: number; note?: string }) => {
      const r = await resolveIssue(a.id, actor, a.note ?? null);
      return {
        state: r.state,
        status: r.issue.status,
        message: "message" in r ? r.message : undefined,
      };
    }),
  );

  server.registerTool(
    "snooze_issue",
    {
      title: "Snooze an issue",
      description:
        "Hide an issue from the agent's work queue for N days, e.g. while waiting on a source to publish. People: 1–90 days. The agent: at most 14, with the reason.",
      inputSchema: {
        id: z.number().int(),
        days: z.number().int().min(1).max(90),
        reason: z.string().min(1),
      },
    },
    wrap(async (a: { id: number; days: number; reason: string }) => {
      const days = ctx.isAgent ? Math.min(a.days, 14) : a.days;
      await snoozeIssue(a.id, actor, days, a.reason);
      return { ok: true, days };
    }),
  );

  server.registerTool(
    "raise_issue",
    {
      title: "Raise a finding",
      description:
        "Record a problem the detectors can't see (a code bug, suspicious values, a source change coming). It goes to a person; include file:line references for code bugs.",
      inputSchema: {
        subject_type: z.enum(["series", "loader", "code", "source"]),
        subject_id: z.number().int().optional(),
        title: z.string().min(5).max(200),
        body: z.string().min(1).max(8000),
      },
    },
    wrap(
      async (a: {
        subject_type: string;
        subject_id?: number;
        title: string;
        body: string;
      }) => {
        const issue = await raiseFinding(actor, {
          universe: U,
          subjectType: a.subject_type,
          subjectId: a.subject_id ?? null,
          title: a.title,
          body: a.body,
        });
        return { id: issue.id, url: issueUrl(U, issue.id) };
      },
    ),
  );

  server.registerTool(
    "list_proposals",
    {
      title: "List proposals",
      description:
        "Proposed changes and their review state. pending = shown for review now; queued = ready behind it.",
      inputSchema: {
        status: z
          .array(
            z.enum([
              "queued",
              "pending",
              "approved",
              "applied",
              "failed",
              "rejected",
              "superseded",
              "stale",
              "withdrawn",
            ]),
          )
          .optional(),
      },
    },
    wrap(
      async ({
        status,
      }: {
        status?: Array<
          | "queued"
          | "pending"
          | "approved"
          | "applied"
          | "failed"
          | "rejected"
          | "superseded"
          | "stale"
          | "withdrawn"
        >;
      }) =>
        (
          await ProposalStore.list({
            universe: U,
            status: status ?? ["queued", "pending"],
          })
        ).map((p) => ({
          id: p.id,
          kind: p.kind,
          status: p.status,
          summary: p.summary,
          targets: p.targets,
          issue_id: p.issueId,
          created_at: p.createdAt,
          review_note: p.reviewNote,
        })),
    ),
  );

  if (!ctx.isAgent) {
    server.registerTool(
      "assign_issue",
      {
        title: "Take or release an issue",
        description:
          "Assign an issue to yourself (the agent leaves it alone until you release it), or release it back.",
        inputSchema: { id: z.number().int(), take: z.boolean() },
      },
      wrap(async (a: { id: number; take: boolean }) => {
        await assignIssue(a.id, actor, a.take ? actor.userId : null);
        return { ok: true };
      }),
    );
  }

  // ── Proposals: create (agent and devs) ──
  if ((ctx.isAgent && ctx.agentCanPropose) || ctx.isDev) {
    server.registerTool(
      "propose_change",
      {
        title: "Propose a change",
        description:
          "Propose a fix for review. One proposal can cover a whole group of issues with the same fix (one target per loader/series/measurement). " +
          "The server records each target's current state, re-validates, and dry-runs load-statement changes; a failing dry run is refused. " +
          "kinds: loader_update (after: eval/priority/scale/…), loader_create (target = series, after.eval), loader_disable, " +
          "reload (re-run a loader, e.g. after a temporary failure), " +
          "measurement_metadata (target = measurement; after: source_id, unit_id, source_detail_id, dataPortalName, source_link) for values every series in the measurement shares, " +
          "series_metadata (target = series; after: source_id, unit_id, source_detail_id, geography_id, dataPortalName, description, source_link) when series in a measurement legitimately differ, unquarantine. " +
          "For metadata kinds, set basis: measurement_series (the measurement's series that have a value all agree) or research (found on a source website); cite where each value came from in evidence.",
        inputSchema: {
          issue_id: z.number().int().optional(),
          kind: z.enum([
            "loader_update",
            "loader_create",
            "loader_disable",
            "series_metadata",
            "measurement_metadata",
            "unquarantine",
            "reload",
          ]),
          summary: z
            .string()
            .min(10)
            .max(500)
            .describe("One line a reviewer reads first"),
          evidence: z
            .string()
            .min(10)
            .max(12000)
            .describe("Why: the cause, what you checked, sources for values"),
          basis: z.enum(["measurement_series", "research"]).optional(),
          targets: z
            .array(
              z.object({
                target_type: z.enum(["loader", "series", "measurement"]),
                target_id: z.number().int(),
                issue_id: z.number().int().optional(),
                after: z.record(z.string(), z.unknown()),
              }),
            )
            .min(1)
            .max(200),
        },
      },
      wrap(
        async (a: {
          issue_id?: number;
          kind:
            | "loader_update"
            | "loader_create"
            | "loader_disable"
            | "series_metadata"
            | "measurement_metadata"
            | "unquarantine"
            | "reload";
          summary: string;
          evidence: string;
          basis?: "measurement_series" | "research";
          targets: Array<{
            target_type: "loader" | "series" | "measurement";
            target_id: number;
            issue_id?: number;
            after: Record<string, unknown>;
          }>;
        }) => {
          const r = await createProposal(actor, {
            universe: U,
            issueId: a.issue_id ?? null,
            kind: a.kind,
            summary: a.summary,
            evidence: a.evidence,
            basis: a.basis,
            targets: a.targets.map((t) => ({
              targetType: t.target_type,
              targetId: t.target_id,
              issueId: t.issue_id ?? null,
              after: t.after,
            })),
          });
          return {
            state: r.state,
            proposal_id: r.proposal.id,
            status: r.proposal.status,
            result: "result" in r ? r.result : undefined,
          };
        },
      ),
    );
  }

  // ── Reviewers ──
  if (ctx.canReview) {
    server.registerTool(
      "review_proposal",
      {
        title: "Approve or reject a proposal",
        description:
          "Reviewers only. Approving applies the change (each target re-checked for edits since it was proposed).",
        inputSchema: {
          id: z.number().int(),
          decision: z.enum(["approve", "reject"]),
          note: z.string().max(2000).optional(),
        },
      },
      wrap(
        async (a: {
          id: number;
          decision: "approve" | "reject";
          note?: string;
        }) => {
          const p = await reviewProposal(
            a.id,
            actor,
            a.decision,
            a.note ?? null,
          );
          return { id: p.id, status: p.status };
        },
      ),
    );
  }

  // ── Dev-only ──
  if (ctx.isDev) {
    server.registerTool(
      "dismiss_issue",
      {
        title: "Dismiss an issue",
        description:
          "Dev only. Mark an issue as not a problem (e.g. a series intentionally without a source). It stays dismissed until its condition changes.",
        inputSchema: {
          id: z.number().int(),
          reason: z.string().min(3).max(500),
        },
      },
      wrap(async (a: { id: number; reason: string }) => {
        await dismissIssue(a.id, actor, a.reason);
        return { ok: true };
      }),
    );

    server.registerTool(
      "reopen_issue",
      {
        title: "Reopen an issue",
        description:
          "Dev only. Undo a dismissal or snooze, or reopen a resolved issue.",
        inputSchema: {
          id: z.number().int(),
          reason: z.string().max(500).optional(),
        },
      },
      wrap(async (a: { id: number; reason?: string }) => {
        await reopenIssue(a.id, actor, a.reason ?? null);
        return { ok: true };
      }),
    );

    server.registerTool(
      "update_loader",
      {
        title: "Edit a loader",
        description:
          "Dev only. Edit a loader directly (logged in loader actions, recorded on its issues). Prefer dry_run_loader first. Fields: eval, priority, scale, presaveHook, clearBeforeLoad, pseudoHistory, reloadNightly, maxLagDays.",
        inputSchema: {
          loader_id: z.number().int(),
          changes: z.record(z.string(), z.unknown()),
          issue_id: z.number().int().optional(),
          reload: z
            .boolean()
            .optional()
            .describe("Queue a reload after (default true)"),
        },
      },
      wrap(
        async (a: {
          loader_id: number;
          changes: Record<string, unknown>;
          issue_id?: number;
          reload?: boolean;
        }) => {
          const before = await currentLoaderState(a.loader_id);
          const r = await applyLoaderUpdate(
            a.loader_id,
            a.changes,
            actor,
            a.issue_id ?? null,
          );
          if (a.reload !== false)
            await requestReload(a.loader_id, actor, a.issue_id ?? null);
          return { ok: true, warnings: r.warnings, before };
        },
      ),
    );

    server.registerTool(
      "update_series_metadata",
      {
        title: "Edit series metadata",
        description:
          "Dev only. Set metadata fields on a series: source_id, unit_id, source_detail_id, geography_id, dataPortalName, description, source_link.",
        inputSchema: {
          series_id: z.number().int(),
          changes: z.record(z.string(), z.unknown()),
          issue_id: z.number().int().optional(),
        },
      },
      wrap(
        async (a: {
          series_id: number;
          changes: Record<string, unknown>;
          issue_id?: number;
        }) => {
          await applySeriesMetadata(
            a.series_id,
            a.changes,
            actor,
            a.issue_id ?? null,
          );
          return { ok: true };
        },
      ),
    );

    server.registerTool(
      "update_measurement_metadata",
      {
        title: "Edit measurement metadata",
        description:
          "Dev only. Set metadata on a measurement: source_id, unit_id, source_detail_id, dataPortalName, source_link. Series without their own value show the measurement's on the portal.",
        inputSchema: {
          measurement_id: z.number().int(),
          changes: z.record(z.string(), z.unknown()),
          issue_id: z.number().int().optional(),
        },
      },
      wrap(
        async (a: {
          measurement_id: number;
          changes: Record<string, unknown>;
          issue_id?: number;
        }) => {
          await applyMeasurementMetadata(
            a.measurement_id,
            a.changes,
            actor,
            a.issue_id ?? null,
          );
          return { ok: true };
        },
      ),
    );

    server.registerTool(
      "request_reload",
      {
        title: "Reload a loader",
        description:
          "Dev only. Queue a reload of one loader. With issue_id, the issue is verified when it finishes.",
        inputSchema: {
          loader_id: z.number().int(),
          issue_id: z.number().int().optional(),
        },
      },
      wrap(async (a: { loader_id: number; issue_id?: number }) => {
        await requestReload(a.loader_id, actor, a.issue_id ?? null);
        return { ok: true };
      }),
    );
  }

  // ── Runner bookkeeping (agent only; the runner calls these directly) ──
  if (ctx.isAgent) {
    server.registerTool(
      "run_start",
      {
        title: "Start an agent run",
        description:
          "Runner bookkeeping: create a run record. Returns the run id, budget and settings.",
        inputSchema: {
          trigger: z.string(),
          model: z.string(),
          git_sha: z.string().optional(),
        },
      },
      wrap(async (a: { trigger: string; model: string; git_sha?: string }) => {
        const runId = await startRun({
          universe: U,
          trigger: a.trigger,
          model: a.model,
          gitSha: a.git_sha ?? null,
        });
        return {
          run_id: runId,
          budget: await getBudget(U),
          settings: await getOpsSettings(U),
        };
      }),
    );

    server.registerTool(
      "run_get_work",
      {
        title: "Get work for this run",
        description:
          "Runner bookkeeping: the items to investigate now, in order. Empty while the ready buffer is full, the budget is used, or nothing is workable. Also the runner's liveness signal.",
        inputSchema: {},
      },
      wrap(async () => {
        await recordPoll(U);
        const work = await getWork(U);
        await claimWork(work.items);
        return work;
      }),
    );

    server.registerTool(
      "run_budget",
      {
        title: "Budget status",
        description: "Runner bookkeeping: today's and this month's spend.",
        inputSchema: {},
      },
      wrap(async () => getBudget(U)),
    );

    server.registerTool(
      "run_log",
      {
        title: "Log run steps",
        description: "Runner bookkeeping: record steps and usage for a run.",
        inputSchema: {
          run_id: z.number().int(),
          steps: z.array(
            z.object({
              issue_id: z.number().int().nullable().optional(),
              seq: z.number().int(),
              kind: z.enum([
                "tool_call",
                "assistant",
                "error",
                "note",
                "usage",
              ]),
              tool_name: z.string().nullable().optional(),
              input: z.string().nullable().optional(),
              output: z.string().nullable().optional(),
              is_error: z.boolean().optional(),
              duration_ms: z.number().nullable().optional(),
              cost_usd: z.number().nullable().optional(),
            }),
          ),
          usage: z
            .object({
              input_tokens: z.number(),
              output_tokens: z.number(),
              cache_write_tokens: z.number(),
              cache_read_tokens: z.number(),
              web_search_requests: z.number(),
              cost_usd: z.number(),
            })
            .optional(),
        },
      },
      wrap(
        async (a: {
          run_id: number;
          steps: Array<{
            issue_id?: number | null;
            seq: number;
            kind: "tool_call" | "assistant" | "error" | "note" | "usage";
            tool_name?: string | null;
            input?: string | null;
            output?: string | null;
            is_error?: boolean;
            duration_ms?: number | null;
            cost_usd?: number | null;
          }>;
          usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_write_tokens: number;
            cache_read_tokens: number;
            web_search_requests: number;
            cost_usd: number;
          };
        }) => {
          await logSteps(
            a.run_id,
            a.steps.map((s) => ({
              issueId: s.issue_id ?? null,
              seq: s.seq,
              kind: s.kind,
              toolName: s.tool_name ?? null,
              input: s.input ?? null,
              output: s.output ?? null,
              isError: s.is_error,
              durationMs: s.duration_ms ?? null,
              costUsd: s.cost_usd ?? null,
            })),
          );
          if (a.usage) {
            await addRunUsage(a.run_id, {
              inputTokens: a.usage.input_tokens,
              outputTokens: a.usage.output_tokens,
              cacheWriteTokens: a.usage.cache_write_tokens,
              cacheReadTokens: a.usage.cache_read_tokens,
              webSearchRequests: a.usage.web_search_requests,
              costUsd: a.usage.cost_usd,
            });
          }
          return { ok: true };
        },
      ),
    );

    server.registerTool(
      "run_finish",
      {
        title: "Finish an agent run",
        description: "Runner bookkeeping: close the run record.",
        inputSchema: {
          run_id: z.number().int(),
          status: z.enum(["finished", "failed", "budget_stopped"]),
          stop_reason: z.string().optional(),
          issues_investigated: z.number().int(),
          proposals_created: z.number().int(),
          summary: z.string().max(4000).optional(),
          error: z.string().max(4000).optional(),
        },
      },
      wrap(
        async (a: {
          run_id: number;
          status: "finished" | "failed" | "budget_stopped";
          stop_reason?: string;
          issues_investigated: number;
          proposals_created: number;
          summary?: string;
          error?: string;
        }) => {
          await finishRun(a.run_id, {
            status: a.status,
            stopReason: a.stop_reason,
            issuesInvestigated: a.issues_investigated,
            proposalsCreated: a.proposals_created,
            summary: a.summary,
            error: a.error,
          });
          return { ok: true };
        },
      ),
    );
  }
}
