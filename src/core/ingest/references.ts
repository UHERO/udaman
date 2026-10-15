/**
 * Find the load statements that read an extractor:
 *   Series.load_from_extract("bls", { series_id: "CUSR0000SA0" })
 * Parsing the eval (instead of a regex) means chained and arithmetic evals
 * count too. Used by sources whose fetch list comes from the load
 * statements (BLS), and later by save-time validation.
 */

import EvalParser from "@catalog/utils/eval-parser";
import type { EvalArg, EvalNode } from "@catalog/utils/eval-parser";

import { mysql } from "@/lib/mysql/helpers";

export const LOAD_METHOD = "load_from_extract";

/** One load_from_extract call found in an eval. */
export type ExtractCall = {
  handle: string | null;
  filters: Record<string, string | number | boolean> | null;
};

function literalString(arg: EvalArg | undefined): string | null {
  return arg && (arg.type === "string" || arg.type === "symbol")
    ? arg.value
    : null;
}

/** Every load_from_extract call anywhere in an eval's AST. */
export function findExtractCalls(node: EvalNode): ExtractCall[] {
  const out: ExtractCall[] = [];
  const visit = (n: EvalNode) => {
    switch (n.type) {
      case "static_method":
        if (n.method === LOAD_METHOD) {
          const opts = n.args[1];
          out.push({
            handle: literalString(n.args[0]),
            filters: opts?.type === "options" ? opts.value : null,
          });
        }
        for (const a of n.args) if (a.type === "expression") visit(a.node);
        break;
      case "instance_method":
        visit(n.target);
        for (const a of n.args) if (a.type === "expression") visit(a.node);
        break;
      case "arithmetic":
        visit(n.left);
        visit(n.right);
        break;
      default:
        break;
    }
  };
  visit(node);
  return out;
}

/** load_from_extract calls in one eval string ([] if it does not parse). */
export function extractCallsIn(evalStr: string): ExtractCall[] {
  try {
    return findExtractCalls(EvalParser.parse(evalStr));
  } catch {
    return [];
  }
}

/**
 * Distinct filters (values as strings) of enabled load statements that
 * read any of `handles`.
 */
export async function referencedFilters(
  handles: string[],
): Promise<Array<Record<string, string>>> {
  if (handles.length === 0) return [];
  const rows = await mysql<{ eval: string }>`
    SELECT eval FROM data_sources
    WHERE NOT disabled AND eval LIKE ${`%${LOAD_METHOD}%`}
  `;
  const wanted = new Set(handles);
  const seen = new Map<string, Record<string, string>>();
  for (const r of rows) {
    for (const call of extractCallsIn(r.eval)) {
      if (!call.handle || !wanted.has(call.handle) || !call.filters) continue;
      const f = Object.fromEntries(
        Object.entries(call.filters).map(([k, v]) => [k, String(v)]),
      );
      seen.set(JSON.stringify(Object.entries(f).sort()), f);
    }
  }
  return [...seen.values()];
}
