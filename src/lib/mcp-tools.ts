/**
 * Registers all seven MCP tools and contains the per-tool logic:
 *   - search_series       : code input → exact /series?name= lookup; free-text
 *                           → /search/series?q= with single-token fallback
 *   - get_observations    : one series by id or code. Defaults to the series's
 *                           full published range when dates are omitted.
 *                           Supports `unrestricted: true` (code only, lvl only).
 *   - compare_series      : 2-8 series aligned on a common date axis.
 *                           Per-entry classification distinguishes `restricted`
 *                           from `not_found` so Claude can retry with unrestricted.
 *   - list_geographies, list_categories, list_series_in_group,
 *     list_series_siblings : discovery/browsing tools
 *
 * Also contains:
 *   - projectSeries()        : adds a per-series `citation` field so Claude
 *                              can cite specifically rather than generically
 *   - classifyMissingCode()  : when a public lookup returns the hollow
 *                              {id:0, name:""} shape, probes /v1.u to tell
 *                              "doesn't exist" from "exists but restricted"
 *   - access: "restricted" + access_note flags on unrestricted-mode responses
 *     so Claude discloses restricted-data status — even in follow-ups
 *     paraphrased from earlier conversation context.
 */

import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  clampObservations,
  describeDisambiguation,
  formatSeriesCode,
  parseSeriesCode,
} from "@/lib/series-code";
import {
  getCategorySeries,
  getSeriesByCode,
  getSeriesByCodeWithObservations,
  getSeriesObservations,
  getSeriesSiblings,
  listCategories,
  listGeographiesForSeries,
  normalizeObservations,
  searchSeries,
  searchSeriesByText,
  UheroApiError,
  type Frequency,
  type ObservationPoint,
  type RawGeography,
  type RawSeries,
  type Transform,
} from "@/lib/uhero-client";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  A: "year",
  Q: "quarter",
  M: "month",
  W: "week",
  D: "day",
};

const TRANSFORM_VALUES = ["lvl", "pch", "pc1", "ytd", "chg", "ch1"] as const;

const HAWAII_GEOGRAPHIES: RawGeography[] = [
  { handle: "HI", fips: "15", name: "State of Hawaii" },
  { handle: "HON", fips: "15003", name: "City and County of Honolulu" },
  { handle: "HAW", fips: "15001", name: "Hawaii County" },
  { handle: "MAU", fips: "15009", name: "Maui County" },
  { handle: "KAU", fips: "15007", name: "Kauai County" },
  { handle: "LAN", name: "Lanai Island" },
  { handle: "MOL", name: "Molokai Island" },
  { handle: "MAUI", name: "Maui Island" },
];

interface ToolContext {
  userId: string;
  userEmail?: string | null;
}

const SOURCE = {
  provider: "UHERO (University of Hawaii Economic Research Organization)",
  api: "https://api.uhero.hawaii.edu/v1",
  portal: "https://uhero.hawaii.edu/data/",
  citation:
    "Data retrieved from the UHERO API. Cite as 'Source: UHERO (uhero.hawaii.edu)' in any chart, summary, or report.",
} as const;

function jsonResult(payload: Record<string, unknown> | unknown[] | { error: string }) {
  const withSource =
    Array.isArray(payload) || (payload && typeof payload === "object")
      ? { ...(payload as Record<string, unknown>), source: SOURCE }
      : payload;
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(withSource, null, 2) },
    ],
  };
}

/**
 * Build a precise per-series citation string suitable for chart legends and
 * inline source attribution. Format:
 *   "<title> (<code>, <geography>, <frequency>). Source: UHERO."
 * Example:
 *   "Earnings Per Job (YPJ_R@HI.A, State of Hawaii, year). Source: UHERO (uhero.hawaii.edu)."
 */
function seriesCitation(s: RawSeries): string {
  const code = s.geography?.handle && s.frequencyShort
    ? formatSeriesCode(stripCodeSuffix(s.name), s.geography.handle, s.frequencyShort)
    : s.name;
  const title = s.title || stripCodeSuffix(s.name);
  const geo = s.geography?.name ?? s.geography?.handle ?? "";
  const freq = FREQUENCY_LABELS[s.frequencyShort] ?? s.frequency;
  const parts = [code, geo, freq].filter(Boolean).join(", ");
  return `${title} (${parts}). Source: UHERO (uhero.hawaii.edu).`;
}

function projectSeries(s: RawSeries) {
  const geo = s.geography?.handle;
  const baseName = stripCodeSuffix(s.name);
  const code =
    geo && s.frequencyShort
      ? formatSeriesCode(baseName, geo, s.frequencyShort)
      : s.name;
  return {
    id: s.id,
    code,
    name: s.title || baseName,
    geo,
    geo_name: s.geography?.name,
    freq: s.frequencyShort,
    frequency_label: FREQUENCY_LABELS[s.frequencyShort] ?? s.frequency,
    units: s.unitsLabel ?? s.units,
    units_short: s.unitsLabelShort,
    seasonally_adjusted: s.seasonallyAdjusted,
    observation_start: s.observationStart,
    observation_end: s.observationEnd,
    citation: seriesCitation(s),
  };
}

function stripCodeSuffix(rawName: string): string {
  const at = rawName.indexOf("@");
  return at === -1 ? rawName : rawName.slice(0, at);
}

function uniqStr(arr: string[]): string[] {
  const seen: Record<string, true> = {};
  const out: string[] = [];
  for (const v of arr) {
    if (!seen[v]) {
      seen[v] = true;
      out.push(v);
    }
  }
  return out;
}

function logToolCall(ctx: ToolContext, tool: string, input: unknown) {
  console.log(
    JSON.stringify({
      msg: "mcp_tool_call",
      tool,
      userId: ctx.userId,
      userEmail: ctx.userEmail ?? null,
      input,
    })
  );
}

/**
 * When a code lookup fails on the public API, probe the unrestricted API to
 * tell apart "doesn't exist anywhere" from "exists but is restricted." UHERO
 * returns the same hollow `{id:0, name:""}` shape either way on the public
 * endpoint, so we can't distinguish without this second call.
 *
 * Returns:
 *   - 'restricted'  → series exists on /v1.u but not on /v1
 *   - 'not_found'   → series doesn't exist on either side
 */
async function classifyMissingCode(code: string): Promise<"restricted" | "not_found"> {
  try {
    const found = await getSeriesByCode(code, { unrestricted: true });
    return found ? "restricted" : "not_found";
  } catch {
    // If the unrestricted probe itself errors, we can't be sure — assume
    // not_found so we don't mislead the user with a false "restricted" hint.
    return "not_found";
  }
}

function missingCodeError(code: string, classification: "restricted" | "not_found"): string {
  if (classification === "restricted") {
    return (
      `Series '${code}' exists in UHERO's restricted dataset but is not in the public API. ` +
      `Re-run this tool with 'unrestricted: true' to fetch it.`
    );
  }
  return `No series found for code '${code}'.`;
}

function safeError(err: unknown): string {
  if (err instanceof UheroApiError) {
    return `UHERO API error (status ${err.status}). The MCP could not complete this request.`;
  }
  if (err instanceof Error) {
    return `Error: ${err.message.replace(/Bearer\s+\S+/gi, "Bearer ***")}`;
  }
  return "Unknown error contacting UHERO API.";
}

export function registerUheroTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "search_series",
    {
      title: "Search UHERO Series",
      description:
        "Find UHERO time-series by free-text query OR by a UHERO code like 'UR@HON.M' " +
        "(name@geography.frequency). Geographies include HI (state), HON (Honolulu), HAW (Hawaii County), " +
        "MAU (Maui), KAU (Kauai). Frequencies are A=annual, Q=quarterly, M=monthly, W=weekly, D=daily. " +
        "When more than one match comes back, the response includes a disambiguation_hint and may set " +
        "next_step='ask_user_to_pick' — in that case, ask the user which series they meant before fetching observations. " +
        "Every response includes a 'source' object; always cite 'Source: UHERO (uhero.hawaii.edu)' in any answer, chart, or summary you produce.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Free-text query (e.g. 'unemployment rate Honolulu') OR a UHERO code like 'UR@HON.M'."
          ),
        geo: z
          .string()
          .optional()
          .describe("Optional geography handle filter, e.g. 'HON' or 'HI'."),
        freq: z
          .enum(["A", "Q", "M", "W", "D"])
          .optional()
          .describe("Optional frequency filter."),
      },
    },
    async ({ query, geo, freq }) => {
      logToolCall(ctx, "search_series", { query, geo, freq });
      try {
        const parsed = parseSeriesCode(query);
        let raw: RawSeries[];
        if (parsed) {
          // Exact-code lookup. UHERO's `search_text` doesn't index code
          // stems (e.g. YPJ_R), so use `/series?name=&u=uhero` instead.
          const found = await getSeriesByCode(query.trim().toUpperCase());
          raw = found ? [found] : [];
        } else {
          // Free-text: `/search/series?q=` searches title + description and
          // returns better hits than `/series?search_text=`. UHERO matches
          // the query as a phrase; if multi-word fails, try the first token.
          raw = await searchSeriesByText({
            q: query,
            geo,
            freq: freq as Frequency | undefined,
          });
          if (raw.length === 0 && query.includes(" ")) {
            const firstToken = query.trim().split(/\s+/)[0];
            if (firstToken) {
              raw = await searchSeriesByText({
                q: firstToken,
                geo,
                freq: freq as Frequency | undefined,
              });
            }
          }
        }

        const total = raw.length;
        const matches = raw.slice(0, 10).map(projectSeries);
        const hint = describeDisambiguation(raw.slice(0, 10));
        const ambiguous = total > 1 && !parsed;

        return jsonResult({
          matches,
          total_matches: total,
          disambiguation_hint: hint,
          next_step: ambiguous ? "ask_user_to_pick" : undefined,
          note:
            total > 10
              ? `Returned the first 10 of ${total} matches. Refine the query to narrow further.`
              : undefined,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );

  server.registerTool(
    "list_series_in_group",
    {
      title: "List Series in a UHERO Group",
      description:
        "Return the curated list of series in a UHERO category/group, the way the UHERO data portal organizes them. " +
        "Better than free-text search when the user asks for a topic like 'employment data' or 'tourism indicators'. " +
        "Provide either a free-text 'group' name (fuzzy-matched against UHERO categories) or an exact 'category_id'. " +
        "Returns up to 30 series; if there are more, refine by asking the user which subset they want. " +
        "When presenting results to the user, show each series's human-readable 'name' (not just the code). " +
        "Always cite the source: 'Source: UHERO (uhero.hawaii.edu)' — the response includes a 'source' object with the full citation.",
      inputSchema: {
        group: z
          .string()
          .optional()
          .describe(
            "Free-text group name like 'employment', 'unemployment', 'income', 'tourism'."
          ),
        category_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Exact UHERO category id, if known."),
        geo: z
          .string()
          .optional()
          .describe("Optional geography filter, e.g. 'HON'."),
        freq: z
          .enum(["A", "Q", "M", "W", "D"])
          .optional()
          .describe("Optional frequency filter."),
      },
    },
    async ({ group, category_id, geo, freq }) => {
      logToolCall(ctx, "list_series_in_group", {
        group,
        category_id,
        geo,
        freq,
      });
      try {
        if (!group && !category_id) {
          return jsonResult({
            error:
              "Provide either 'group' (free-text) or 'category_id'. Use list_series_in_group with a topic name to discover ids.",
          });
        }

        let resolvedId = category_id;
        let resolvedName: string | undefined;

        if (!resolvedId && group) {
          const categories = await listCategories();
          const needle = group.toLowerCase();
          const exact = categories.find((c) => c.name.toLowerCase() === needle);
          const partial = categories.find((c) =>
            c.name.toLowerCase().includes(needle)
          );
          const match = exact ?? partial;
          if (!match) {
            const hints = categories
              .slice(0, 15)
              .map((c) => `${c.id}: ${c.name}`)
              .join(", ");
            return jsonResult({
              error: `No UHERO category matched '${group}'.`,
              available_examples: hints,
            });
          }
          resolvedId = match.id;
          resolvedName = match.name;
        }

        const series = await getCategorySeries(
          resolvedId!,
          geo,
          freq as Frequency | undefined
        );

        return jsonResult({
          category: { id: resolvedId, name: resolvedName },
          series: series.slice(0, 30).map(projectSeries),
          total: series.length,
          note:
            series.length > 30
              ? `Returned the first 30 of ${series.length} series. Filter by geo or freq to narrow.`
              : undefined,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );

  server.registerTool(
    "get_observations",
    {
      title: "Get UHERO Series Observations",
      description:
        "Fetch values for a single UHERO series by id or code (e.g. 'UR@HON.M'). " +
        "Optional date range as 'YYYY-MM' strings; if omitted, returns the series's FULL published range " +
        "(from observationStart to observationEnd). The 'applied_range' field tells you what window was used. " +
        "Optional transform: lvl=level (default), pch=period-over-period % change, pc1=year-over-year % change, " +
        "ytd=year-to-date, chg=period change, ch1=year-over-year change. " +
        "Set 'unrestricted: true' to query UHERO's restricted-access API for series not exposed publicly. " +
        "This requires 'series_code' (not series_id) and is meant for internal/research use; omit unless the user explicitly asks for a restricted series. " +
        "When charting or summarizing, label with 'series.name' (e.g. 'Earnings Per Job') and put 'series.units' on the axis. " +
        "ALWAYS cite the precise series — use 'series.citation' verbatim (e.g. 'Earnings Per Job (YPJ_R@HI.A, State of Hawaii, year). Source: UHERO (uhero.hawaii.edu).'). " +
        "Do not use only the generic 'source.citation' when a specific series is being shown — the per-series citation is more useful to the reader. " +
        "If the response includes 'access: \"restricted\"', you MUST tell the user the data came from UHERO's restricted dataset (the 'access_note' field tells you exactly what to say). " +
        "This applies to follow-up answers in the same conversation too — even if you're working from a cached earlier result, surface the restricted-access status whenever you display values from this series.",
      inputSchema: {
        series_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("UHERO series id (preferred when known). Ignored if unrestricted=true."),
        series_code: z
          .string()
          .optional()
          .describe(
            "UHERO code like 'UR@HON.M'. Used if series_id is not provided. Required when unrestricted=true."
          ),
        start: z
          .string()
          .regex(/^\d{4}(-\d{2})?$/)
          .optional()
          .describe("Inclusive start, 'YYYY' or 'YYYY-MM'."),
        end: z
          .string()
          .regex(/^\d{4}(-\d{2})?$/)
          .optional()
          .describe("Inclusive end, 'YYYY' or 'YYYY-MM'."),
        transform: z.enum(TRANSFORM_VALUES).optional(),
        unrestricted: z
          .boolean()
          .optional()
          .describe(
            "Use UHERO's restricted-access API for non-public series. Requires series_code. Default false."
          ),
      },
    },
    async ({ series_id, series_code, start, end, transform, unrestricted }) => {
      logToolCall(ctx, "get_observations", {
        series_id,
        series_code,
        start,
        end,
        transform,
        unrestricted,
      });
      try {
        // Unrestricted mode: must use code lookup with expand=true (the only
        // endpoint the /v1.u API supports for observations).
        if (unrestricted) {
          if (!series_code) {
            return jsonResult({
              error: "unrestricted=true requires series_code (the restricted API does not support id lookup).",
            });
          }
          const parsed = parseSeriesCode(series_code);
          if (!parsed) {
            return jsonResult({
              error: `Could not parse series_code '${series_code}'. Expected NAME@GEO.FREQ, e.g. 'UR@HON.M'.`,
            });
          }
          const t: Transform = transform ?? "lvl";
          const result = await getSeriesByCodeWithObservations(
            series_code.trim().toUpperCase(),
            { unrestricted: true }
          );
          if (!result) {
            return jsonResult({
              error: `No series found for code '${series_code}' on the restricted API.`,
            });
          }
          // expand=true returns observations inline (only the `lvl`
          // transformation is included). For other transforms via the
          // unrestricted API we'd need a separate code path UHERO doesn't
          // currently support — surface that limitation to the caller.
          if (t !== "lvl") {
            return jsonResult({
              error: `Transform '${t}' is not supported in unrestricted mode (UHERO's restricted API only returns level data via expand=true). Re-run without 'unrestricted', or use transform='lvl'.`,
            });
          }
          const all = normalizeObservations(result.observations);
          const fullStart = result.series.observationStart ?? (all[0]?.date ?? "");
          const fullEnd =
            result.series.observationEnd ?? (all[all.length - 1]?.date ?? "");
          const range =
            start || end
              ? { start: start ?? fullStart, end: end ?? fullEnd }
              : { start: fullStart, end: fullEnd };
          const trimmed = clampObservations(all, range.start, range.end);
          return jsonResult({
            series: projectSeries(result.series),
            transform: t,
            applied_range: range,
            observations: trimmed satisfies ObservationPoint[],
            total_in_range: trimmed.length,
            access: "restricted",
            access_note:
              `This series is from UHERO's restricted dataset and is not in the public API. ` +
              `When showing this data to the user, tell them it came from UHERO's restricted access.`,
            note: !start && !end
              ? `No date range provided; returned the series's full published range (${range.start}..${range.end}).`
              : undefined,
          });
        }

        let id = series_id;
        let resolved: RawSeries | undefined;
        if (!id && series_code) {
          const parsed = parseSeriesCode(series_code);
          if (!parsed) {
            return jsonResult({
              error: `Could not parse series_code '${series_code}'. Expected NAME@GEO.FREQ, e.g. 'UR@HON.M'.`,
            });
          }
          const codeUpper = series_code.trim().toUpperCase();
          const found = await getSeriesByCode(codeUpper);
          if (!found) {
            const classification = await classifyMissingCode(codeUpper);
            return jsonResult({
              error: missingCodeError(codeUpper, classification),
              restricted: classification === "restricted" ? true : undefined,
            });
          }
          resolved = found;
          id = resolved.id;
        }
        if (!id) {
          return jsonResult({
            error: "Provide either series_id or series_code.",
          });
        }

        if (!resolved) {
          const meta = await searchSeries({ id });
          if (meta[0]) resolved = meta[0];
        }

        const t: Transform = transform ?? "lvl";
        const raw = await getSeriesObservations(id, t);
        const all = normalizeObservations(raw);

        // Default to the series's FULL published range when the caller did
        // not specify dates. Fall back to the series metadata's
        // observationStart/observationEnd if present, otherwise the actual
        // span of the returned points.
        const fullStart =
          resolved?.observationStart ?? (all[0]?.date ?? "");
        const fullEnd =
          resolved?.observationEnd ?? (all[all.length - 1]?.date ?? "");
        const range =
          start || end
            ? { start: start ?? fullStart, end: end ?? fullEnd }
            : { start: fullStart, end: fullEnd };
        const trimmed = clampObservations(all, range.start, range.end);

        const note: string[] = [];
        if (!start && !end) {
          note.push(
            `No date range provided; returned the series's full published range (${range.start}..${range.end}).`
          );
        }
        if (trimmed.length === 0 && all.length > 0) {
          note.push(
            "No observations fell within the requested range; consider widening the window."
          );
        }

        return jsonResult({
          series: resolved ? projectSeries(resolved) : { id },
          transform: t,
          applied_range: range,
          observations: trimmed satisfies ObservationPoint[],
          total_in_range: trimmed.length,
          note: note.length ? note.join(" ") : undefined,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );

  server.registerTool(
    "compare_series",
    {
      title: "Compare Multiple UHERO Series",
      description:
        "Fetch and align multiple UHERO series on a common date axis. Use this for prompts like " +
        "'compare unemployment across counties over the last 4 years' — pass 2 to 8 series codes or ids " +
        "and an optional date range. Returns a wide table: { dates: [...], series: [{ code, name, geo_name, units, citation, values: [...] }, ...] }. " +
        "If start/end are omitted, returns the widest available range across the compared series. " +
        "Set 'unrestricted: true' to use UHERO's restricted-access API for non-public series; in that mode every entry must be a code (not id) and only transform='lvl' is supported. " +
        "When charting, use each series's 'name' + 'geo_name' as the legend label (e.g. 'Earnings Per Job — State of Hawaii'). " +
        "Falling back to 'code' alone is unreadable for non-technical audiences. " +
        "Include units from 'series[].units' in axis labels. " +
        "ALWAYS cite each series specifically using 'series[].citation' — list every series's citation under the chart or in the answer, " +
        "rather than a single generic 'Source: UHERO'. The per-series citations identify exactly which metric, geography, and frequency was shown. " +
        "If the response includes 'access: \"restricted\"', you MUST tell the user the comparison includes data from UHERO's restricted dataset (the 'access_note' field tells you exactly what to say). " +
        "This applies to follow-up answers in the same conversation too — even when reusing a cached earlier result, surface the restricted-access status whenever you display values from these series.",
      inputSchema: {
        series: z
          .array(z.union([z.string(), z.number().int().positive()]))
          .min(2)
          .max(8)
          .describe(
            "Array of 2-8 series codes (e.g. 'UR@HON.M') or ids. Mixing codes and ids is allowed. With unrestricted=true, only codes are allowed."
          ),
        start: z
          .string()
          .regex(/^\d{4}(-\d{2})?$/)
          .optional(),
        end: z
          .string()
          .regex(/^\d{4}(-\d{2})?$/)
          .optional(),
        transform: z.enum(TRANSFORM_VALUES).optional(),
        unrestricted: z
          .boolean()
          .optional()
          .describe(
            "Use UHERO's restricted-access API for non-public series. Requires all entries to be codes; only transform='lvl' supported. Default false."
          ),
      },
    },
    async ({ series, start, end, transform, unrestricted }) => {
      logToolCall(ctx, "compare_series", { series, start, end, transform, unrestricted });
      try {
        const t: Transform = transform ?? "lvl";

        if (unrestricted && t !== "lvl") {
          return jsonResult({
            error: "unrestricted=true only supports transform='lvl' (UHERO's restricted API doesn't return transformed observations via expand=true).",
          });
        }

        type Resolved =
          | {
              input: string | number;
              meta: RawSeries;
              inlineObservations?: ObservationPoint[];
              error?: undefined;
            }
          | {
              input: string | number;
              meta?: undefined;
              error: "not_found" | "bad_code" | "lookup_failed" | "needs_code_for_unrestricted" | "restricted";
            };

        const resolved: Resolved[] = await Promise.all(
          series.map(async (entry): Promise<Resolved> => {
            try {
              if (typeof entry === "number") {
                if (unrestricted) {
                  return { input: entry, error: "needs_code_for_unrestricted" };
                }
                const meta = await searchSeries({ id: entry });
                if (!meta[0]) return { input: entry, error: "not_found" };
                return { input: entry, meta: meta[0] };
              }
              const parsed = parseSeriesCode(entry);
              if (!parsed) {
                return { input: entry, error: "bad_code" };
              }
              if (unrestricted) {
                const result = await getSeriesByCodeWithObservations(
                  entry.trim().toUpperCase(),
                  { unrestricted: true }
                );
                if (!result) return { input: entry, error: "not_found" };
                return {
                  input: entry,
                  meta: result.series,
                  inlineObservations: normalizeObservations(result.observations),
                };
              }
              const codeUpper = entry.trim().toUpperCase();
              const found = await getSeriesByCode(codeUpper);
              if (!found) {
                const classification = await classifyMissingCode(codeUpper);
                return {
                  input: entry,
                  error: classification === "restricted" ? "restricted" : "not_found",
                };
              }
              return { input: entry, meta: found };
            } catch (e) {
              return { input: entry, error: "lookup_failed" };
            }
          })
        );

        const ok = resolved.filter(
          (r): r is { input: string | number; meta: RawSeries; inlineObservations?: ObservationPoint[] } =>
            !!r.meta
        );
        const failed = resolved.filter((r) => !!r.error);
        const restrictedCodes = failed
          .filter((r) => r.error === "restricted")
          .map((r) => String(r.input));

        if (ok.length < 2) {
          const baseError =
            restrictedCodes.length > 0
              ? `Could not resolve at least 2 valid series. ${restrictedCodes.length} of the requested series ` +
                `(${restrictedCodes.join(", ")}) exist only in UHERO's restricted dataset — re-run with ` +
                `'unrestricted: true' (and codes only, transform='lvl') to include them.`
              : "Could not resolve at least 2 valid series.";
          return jsonResult({ error: baseError, failed });
        }

        const restrictedNote =
          restrictedCodes.length > 0
            ? `${restrictedCodes.length} requested series (${restrictedCodes.join(", ")}) are restricted and were omitted. ` +
              `Re-run with 'unrestricted: true' to include them.`
            : undefined;

        const freqList = ok.map((r) => r.meta.frequencyShort);
        const freqsArr = uniqStr(freqList);
        // Default to the widest available range across the compared series:
        // earliest observationStart and latest observationEnd from metadata.
        const starts = ok
          .map((r) => r.meta.observationStart)
          .filter((s): s is string => !!s)
          .sort();
        const ends = ok
          .map((r) => r.meta.observationEnd)
          .filter((e): e is string => !!e)
          .sort();
        const fullStart = starts[0] ?? "";
        const fullEnd = ends[ends.length - 1] ?? "";
        const range =
          start || end
            ? { start: start ?? fullStart, end: end ?? fullEnd }
            : { start: fullStart, end: fullEnd };

        const observationsBySeries = await Promise.all(
          ok.map(async ({ meta, inlineObservations }) => {
            const all =
              inlineObservations ??
              normalizeObservations(await getSeriesObservations(meta.id, t));
            const trimmed = clampObservations(all, range.start, range.end);
            return { meta, observations: trimmed };
          })
        );

        const dateSet = new Set<string>();
        for (const s of observationsBySeries) {
          for (const o of s.observations) dateSet.add(o.date);
        }
        const dates: string[] = [];
        dateSet.forEach((d) => dates.push(d));
        dates.sort();

        const seriesOut = observationsBySeries.map(({ meta, observations }) => {
          const lookup = new Map(observations.map((o) => [o.date, o.value]));
          const projected = projectSeries(meta);
          return {
            ...projected,
            values: dates.map((d) => lookup.get(d) ?? null),
          };
        });

        const noteParts: string[] = [];
        if (!start && !end) {
          noteParts.push(
            `No date range provided; used the widest available range across the compared series (${range.start}..${range.end}).`
          );
        }
        if (freqsArr.length > 1) {
          noteParts.push(
            `Mixed frequencies in the comparison set (${freqsArr.join(", ")}). Aligned on union of available dates; lower-frequency series will have many nulls.`
          );
        }
        if (failed.length > 0) {
          noteParts.push(
            `${failed.length} input(s) failed to resolve and were excluded.`
          );
        }
        if (restrictedNote) {
          noteParts.push(restrictedNote);
        }

        return jsonResult({
          dates,
          series: seriesOut,
          transform: t,
          applied_range: range,
          failed: failed.length ? failed : undefined,
          access: unrestricted ? "restricted" : undefined,
          access_note: unrestricted
            ? `This comparison includes data from UHERO's restricted dataset (not in the public API). ` +
              `When showing this to the user, tell them at least some series came from restricted access.`
            : undefined,
          note: noteParts.length ? noteParts.join(" ") : undefined,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );

  server.registerTool(
    "list_geographies",
    {
      title: "List UHERO Geographies",
      description:
        "Return common UHERO geography handles for Hawaii (HI=state, HON=Honolulu, HAW=Hawaii County, " +
        "MAU=Maui, KAU=Kauai, LAN=Lanai, MOL=Molokai, MAUI=Maui Island). " +
        "If 'sample_series_id' is provided, fetches the live list of geographies that series is available in " +
        "(useful for confirming a metric exists for a given island/county). Do not invent geo codes — call this first if unsure.",
      inputSchema: {
        sample_series_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Optional: a UHERO series id whose available geographies you want listed."
          ),
      },
    },
    async ({ sample_series_id }) => {
      logToolCall(ctx, "list_geographies", { sample_series_id });
      try {
        if (sample_series_id) {
          const geos = await listGeographiesForSeries(sample_series_id);
          return jsonResult({
            source: "live",
            sample_series_id,
            geographies: geos.map((g) => ({
              handle: g.handle,
              fips: g.fips,
              name: g.name,
            })),
          });
        }
        return jsonResult({
          source: "canonical",
          note: "Common Hawaii handles. For a definitive list for a specific series, pass sample_series_id.",
          geographies: HAWAII_GEOGRAPHIES,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );

  server.registerTool(
    "list_frequencies",
    {
      title: "List UHERO Frequencies",
      description:
        "Return the valid frequency codes used by UHERO series. A=annual, Q=quarterly, M=monthly, W=weekly, D=daily.",
      inputSchema: {},
    },
    async () => {
      logToolCall(ctx, "list_frequencies", {});
      return jsonResult({
        frequencies: (["A", "Q", "M", "W", "D"] as Frequency[]).map((f) => ({
          freq: f,
          label: FREQUENCY_LABELS[f],
        })),
      });
    }
  );

  // Bonus: siblings is cheap and lets compare_series across counties be a single hop.
  server.registerTool(
    "list_series_siblings",
    {
      title: "List Sibling Series",
      description:
        "Given a UHERO series id, return sibling series (same measurement in other geographies or frequencies). " +
        "Useful when the user wants to compare 'this metric across all counties' — call this on one series id to " +
        "discover the matching ids for every geography, then pass them to compare_series.",
      inputSchema: {
        series_id: z.number().int().positive(),
      },
    },
    async ({ series_id }) => {
      logToolCall(ctx, "list_series_siblings", { series_id });
      try {
        const sibs = await getSeriesSiblings(series_id);
        return jsonResult({
          siblings: sibs.map(projectSeries),
          total: sibs.length,
        });
      } catch (err) {
        return jsonResult({ error: safeError(err) });
      }
    }
  );
}
