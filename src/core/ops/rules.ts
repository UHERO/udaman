/*************************************************************************
 * Pure ops rules (no database, no queues), shared by the services and
 * covered by unit tests.
 *************************************************************************/

import type { ChangeType, Lane, ProposalKind } from "./types";

/**
 * Where a metadata value came from:
 *   measurement_series  the measurement's series that have a value all agree
 *   research            found on the source's website or documentation
 */
export type MetadataBasis = "measurement_series" | "research";

/** Compare only the keys `before` names. Loose on null vs "" and number vs string. */
export function stateMatches(
  current: Record<string, unknown>,
  before: Record<string, unknown>,
): boolean {
  const norm = (v: unknown) =>
    v === undefined || v === null || v === "" ? null : String(v);
  return Object.keys(before).every((k) => norm(current[k]) === norm(before[k]));
}

export function laneFor(kind: ProposalKind): Lane {
  return kind === "series_metadata" || kind === "measurement_metadata"
    ? "metadata"
    : "errors";
}

/** Which autonomy setting governs a proposal. */
export function changeTypeFor(
  kind: ProposalKind,
  basis?: MetadataBasis,
): ChangeType {
  switch (kind) {
    case "loader_update":
      return "loader_update";
    case "loader_create":
      return "loader_create";
    case "loader_disable":
      return "loader_disable";
    case "unquarantine":
      return "unquarantine";
    case "reload":
      return "request_reload";
    case "series_metadata":
    case "measurement_metadata":
      return basis === "measurement_series"
        ? "fill_measurement_from_series"
        : "fill_metadata_from_research";
  }
}

/** last_error text written by the lag check (LoaderCollection.lagErrorMessage). */
export const LAG_ERROR_SQL_PREFIX = "Lag limit";
export function isLagError(message: string | null | undefined): boolean {
  return (message ?? "").startsWith(LAG_ERROR_SQL_PREFIX);
}

/**
 * Group key for a lagging loader: loaders reading the same file or download
 * handle wait on the same release, so they are one work item. API and
 * extract loaders group by source and series name prefix.
 */
export function lagGroupKey(
  evalStr: string | null,
  seriesName: string | null,
): string {
  const e = evalStr ?? "";
  const prefix = (seriesName ?? "").split("@")[0] || "?";
  const file = e.match(
    /load_from(?:_file|_download)?\s*\(?\s*["']([^"']+)["']/,
  );
  if (file)
    return `loader_lag:file:${file[1].replace(/\d+/g, "N")}`.slice(0, 190);
  const api = e.match(/load_(api_\w+|from_extract\s*\(\s*["']\w+)/);
  if (api)
    return `loader_lag:${api[1].replace(/\W+/g, ":")}:${prefix}`.slice(0, 190);
  return `loader_lag:${prefix}`;
}

/**
 * A load statement the agent supplies (dry run or proposal) runs on the
 * server. `load_from_file(path)` and `.load_from path` read a file under
 * the data directory, so the agent may only name relative paths with no
 * way out of that directory. Download handles and API loaders can only
 * reach what the catalog already defines. Returns the reason the statement
 * is refused, or null.
 */
export function agentEvalRefusal(evalStr: string): string | null {
  // load_from_file(...) and .load_from ..., but not load_from_download etc.
  const mentions =
    evalStr.match(/load_from(?:_file)?(?![_a-zA-Z0-9])/g)?.length ?? 0;
  const calls = [
    ...evalStr.matchAll(
      /load_from(?:_file)?(?![_a-zA-Z0-9])\s*\(?\s*(["'])(.*?)\1/g,
    ),
  ];
  if (mentions !== calls.length)
    return "load_from / load_from_file needs a literal quoted path";
  for (const c of calls) {
    const p = c[2];
    if (!p || /^[/~]/.test(p) || p.includes("..") || p.includes("\\"))
      return `File path must be relative to the data directory: ${p}`;
  }
  return null;
}

/**
 * Normalize an error message into a grouping signature: numbers, quoted
 * strings and URLs (down to the host) collapse, so "404 for .../file_2024.xlsx"
 * and "404 for .../file_2025.xlsx" group together.
 */
export function errorSignature(message: string): string {
  return message
    .toLowerCase()
    .replace(/https?:\/\/([^/\s]+)\S*/g, "url($1)")
    .replace(/(["'`]).*?\1/g, "'…'")
    .replace(/\d+(\.\d+)?/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}
