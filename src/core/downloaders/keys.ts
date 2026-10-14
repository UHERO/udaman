/**
 * Find the calls to a downloader's load method inside load-statement evals
 * and turn their arguments into internal keys. Parsing the eval (instead of
 * a regex) means chained / arithmetic evals still count:
 *   Series.load_from_bls_api("CUSR0000SA0", "M") * 1000
 *   Series.load_from_dotax_current("ge", "Base", "Retailing", "Maui").trim(...)
 */

import type DownloaderCollection from "@catalog/collections/downloader-collection";
import type { DownloaderLoaderRef } from "@catalog/collections/downloader-collection";
import EvalParser from "@catalog/utils/eval-parser";
import type { EvalArg, EvalNode } from "@catalog/utils/eval-parser";

import type { DownloaderImpl, ResolvedKey } from "./types";

/** Literal value of an argument, or undefined for non-literal args. */
function literal(arg: EvalArg): unknown {
  switch (arg.type) {
    case "string":
    case "number":
    case "symbol":
      return arg.value;
    case "nil":
      return null;
    case "options":
      return arg.value;
    default:
      return undefined;
  }
}

/** Every argument list passed to `method` anywhere in the AST. */
export function findCalls(node: EvalNode, method: string): unknown[][] {
  const out: unknown[][] = [];
  const visit = (n: EvalNode) => {
    switch (n.type) {
      case "static_method":
        if (n.method === method) out.push(n.args.map(literal));
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

export type ResolvedRef = DownloaderLoaderRef & {
  /** Keys this loader reads (usually one) */
  keys: ResolvedKey[];
  /** Parse / argument errors, if the eval does not resolve */
  error: string | null;
};

/** Resolve each load statement's calls to `impl.loadMethod` into keys. */
export function resolveRefs(
  impl: DownloaderImpl,
  refs: DownloaderLoaderRef[],
): ResolvedRef[] {
  return refs.map((ref) => {
    let ast: EvalNode;
    try {
      ast = EvalParser.parse(ref.eval);
    } catch (e) {
      return {
        ...ref,
        keys: [],
        error: `eval does not parse: ${e instanceof Error ? e.message : e}`,
      };
    }
    const keys: ResolvedKey[] = [];
    const errors: string[] = [];
    for (const args of findCalls(ast, impl.loadMethod)) {
      try {
        keys.push(impl.keyFromArgs(args));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { ...ref, keys, error: errors.length ? errors.join("; ") : null };
  });
}

/** Distinct keys referenced by enabled load statements. */
export async function referencedKeys(
  impl: DownloaderImpl,
  collection: typeof DownloaderCollection,
): Promise<{ keys: string[]; errors: ResolvedRef[] }> {
  const refs = resolveRefs(
    impl,
    await collection.getLoaderRefs(impl.loadMethod),
  );
  const keys = new Set<string>();
  for (const r of refs) for (const k of r.keys) keys.add(k.key);
  return { keys: [...keys].sort(), errors: refs.filter((r) => r.error) };
}

/** Lowercase + squish: the normal form of free-text load-method arguments. */
export function norm(v: unknown): string {
  return String(v ?? "")
    .replace(/[‘’ʻ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Letters and digits only, lowercased: for matching table / area names. */
export function compact(v: unknown): string {
  return norm(v).replace(/[^a-z0-9]/g, "");
}
