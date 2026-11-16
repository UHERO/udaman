/** Catalog MCP: looking at sources and at what the loaders logged. */

import "server-only";

import { rawQuery } from "@database/mysql";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { wrap, type CallerContext } from "../shared";

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

export function registerSourceTools(server: McpServer, _ctx: CallerContext) {
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
}
