/**
 * Audit: data points produced by DIVISION where a constituent series had no
 * data (or no usable data) on that date.
 *
 * Addition and subtraction can tolerate a gap in one input; a ratio cannot —
 * if either the numerator or the denominator is missing on a date, no value
 * should exist for that date. This script finds current data points, written
 * by a loader whose eval divides, on dates where a series feeding that
 * division has no current, non-null data point.
 *
 * For each suspect date it also says what the constituent looks like NOW, to
 * help tell the two histories apart:
 *
 *   never-present     — the constituent has no row at all on that date. The
 *                       value slipped through before the arithmetic tightened.
 *   formerly-present  — the constituent has only non-current row(s) there
 *                       (e.g. a since-retracted "0"). The value was computed
 *                       against data that has since been withdrawn.
 *
 * Two secondary signals are reported (never acted on) because the inputs are
 * already in hand: a constituent whose current value is exactly 0 (a false
 * zero, or a zero denominator) and one whose |value| is sentinel-sized
 * (>= 1e11 — see cleanup-bea-false-zeros.ts, which owns that cleanup). This
 * is what YPJAF@HAW.A (160212) turned out to be: its numerator YLAF@HAW.A
 * holds the scaled 1e12 sentinel, not a gap.
 *
 * Constituents are matched by name within the loader's universe, on the same
 * date grid. Division subtrees that transform dates (aggregate, lag, moving
 * averages, …) or pull external data (load_api_*) are skipped by default
 * because a date-for-date comparison would be meaningless there; pass
 * --include-transformed to check them anyway (expect noise).
 *
 * --verify re-runs each flagged loader's eval and keeps a suspect date only
 * if the fresh result does not reproduce it. --execute (implies --verify)
 * deletes the confirmed current rows, then runs repairDataPoints (an older
 * vintage may be promoted back to current — those dates are listed for
 * review, since a promoted vintage can be the very "0" this value was built
 * on) and re-syncs public data points.
 *
 * Usage:
 *   LOG_LEVEL=warn bun run src/core/scripts/find-division-missing-constituents.ts
 *   … --verbose                       list every suspect date
 *   … --series YPJAF@HAW.A            one target series (name or id)
 *   … --ops "/,*"                     also treat * as strict (default "/")
 *   … --include-transformed           don't skip date-shifting subtrees
 *   … --limit 50                      first N division loaders
 *   … --verify                        confirm each date via a fresh eval
 *   … --execute                       delete confirmed rows (dry run otherwise)
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import EvalParser, {
  type EvalArg,
  type EvalNode,
} from "@catalog/utils/eval-parser";
import { mysql } from "@database/mysql";

// ─── CLI ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const EXECUTE = flag("--execute");
const VERIFY = flag("--verify") || EXECUTE;
const VERBOSE = flag("--verbose");
const INCLUDE_TRANSFORMED = flag("--include-transformed");
const LIMIT = opt("--limit") ? parseInt(opt("--limit")!, 10) : Infinity;
const ONLY_SERIES = opt("--series");
const STRICT_OPS = new Set(
  (opt("--ops") ?? "/")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const SENTINEL_ABS = 1e11;

// ─── Types ──────────────────────────────────────────────────────────

type LoaderRow = {
  id: number;
  eval: string;
  series_id: number;
  series_name: string;
  xseries_id: number;
  universe: string;
};

type PointRow = { date: Date | string; value: number | null; current: number };

/** A constituent's rows on one date, for classification. */
type ConstituentState =
  | { kind: "ok"; value: number }
  | { kind: "zero" }
  | { kind: "sentinel"; value: number }
  | { kind: "formerly-present"; lastValue: number | null }
  | { kind: "never-present" };

type Suspect = {
  date: string;
  value: number;
  /** constituent name → why it's unusable */
  reasons: { name: string; state: ConstituentState }[];
};

// ─── AST helpers ────────────────────────────────────────────────────

/** Instance methods that keep the date grid intact. Everything else shifts it. */
const DATE_PRESERVING_METHODS = new Set([
  "ts",
  "tsn",
  "trim",
  "round",
  "abs",
  "scale",
  "rescale",
  "fill_zero",
  "annual_sum",
]);

type Subtree = { refs: Set<string>; transformed: boolean; external: boolean };

/** Series references a subtree depends on, and whether it reshapes dates. */
function inspect(node: EvalNode, acc: Subtree): void {
  switch (node.type) {
    case "series_ref":
      acc.refs.add(node.name);
      break;
    case "scalar":
      break;
    case "arithmetic":
      inspect(node.left, acc);
      inspect(node.right, acc);
      break;
    case "instance_method":
      if (!DATE_PRESERVING_METHODS.has(node.method)) acc.transformed = true;
      inspect(node.target, acc);
      for (const a of node.args) inspectArg(a, acc);
      break;
    case "static_method":
      // Series.load_api_*, Series.share_using, … — inputs we can't diff by date.
      acc.external = true;
      for (const a of node.args) inspectArg(a, acc);
      break;
  }
}

function inspectArg(arg: EvalArg, acc: Subtree): void {
  if (arg.type === "expression") inspect(arg.node, acc);
  else if (arg.type === "series_ref") acc.refs.add(arg.name);
}

/**
 * Every strict-op node in the tree, as the set of series each side depends
 * on. A date is only valid for the loader if ALL of them have data.
 *
 * `outerShift` is true when a date-shifting method wraps this node — e.g.
 * `("A.A".ts / "B.A".ts).fill_interpolate_to(:month)` divides on the annual
 * grid and then expands, so the monthly target can't be diffed against the
 * annual inputs date-for-date.
 */
function strictDivisions(
  node: EvalNode,
  out: { refs: Set<string>; skipped: string | null }[],
  outerShift = false,
): void {
  if (node.type === "arithmetic") {
    if (STRICT_OPS.has(node.op)) {
      const acc: Subtree = {
        refs: new Set(),
        transformed: false,
        external: false,
      };
      inspect(node.left, acc);
      inspect(node.right, acc);
      let skipped: string | null = null;
      if (acc.external) skipped = "external input";
      else if ((acc.transformed || outerShift) && !INCLUDE_TRANSFORMED)
        skipped = outerShift
          ? "result is date-shifted"
          : "date-shifting transform";
      out.push({ refs: acc.refs, skipped });
    }
    strictDivisions(node.left, out, outerShift);
    strictDivisions(node.right, out, outerShift);
  } else if (node.type === "instance_method") {
    const shift = outerShift || !DATE_PRESERVING_METHODS.has(node.method);
    strictDivisions(node.target, out, shift);
    for (const a of node.args)
      if (a.type === "expression") strictDivisions(a.node, out, shift);
  } else if (node.type === "static_method") {
    for (const a of node.args)
      if (a.type === "expression") strictDivisions(a.node, out, true);
  }
}

// ─── Data helpers ───────────────────────────────────────────────────

function toDateStr(d: Date | string): string {
  return d instanceof Date
    ? d.toISOString().slice(0, 10)
    : String(d).slice(0, 10);
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
}

type ConstituentData = {
  current: Map<string, number>; // date → current non-null value
  history: Map<string, number | null>; // date → most recent non-current value
};

const constituentCache = new Map<string, ConstituentData | null>();

/** All rows for a series by name in a universe, split into current vs. history. */
async function loadConstituent(
  name: string,
  universe: string,
): Promise<ConstituentData | null> {
  const key = `${universe} ${name}`;
  if (constituentCache.has(key)) return constituentCache.get(key)!;

  const series = await mysql<{ xseries_id: number }>`
    SELECT xseries_id FROM series
    WHERE name = ${name} AND universe = ${universe}
    LIMIT 1
  `;
  if (!series[0]) {
    constituentCache.set(key, null);
    return null;
  }
  const rows = await mysql<PointRow>`
    SELECT date, value, current FROM data_points
    WHERE xseries_id = ${series[0].xseries_id}
    ORDER BY date, current, updated_at
  `;
  const data: ConstituentData = { current: new Map(), history: new Map() };
  for (const r of rows) {
    const d = toDateStr(r.date);
    if (r.current === 1 && r.value !== null)
      data.current.set(d, Number(r.value));
    else data.history.set(d, r.value === null ? null : Number(r.value));
  }
  constituentCache.set(key, data);
  return data;
}

function classify(c: ConstituentData, date: string): ConstituentState {
  if (c.current.has(date)) {
    const v = c.current.get(date)!;
    if (v === 0) return { kind: "zero" };
    if (Math.abs(v) >= SENTINEL_ABS) return { kind: "sentinel", value: v };
    return { kind: "ok", value: v };
  }
  if (c.history.has(date)) {
    return { kind: "formerly-present", lastValue: c.history.get(date)! };
  }
  return { kind: "never-present" };
}

function describe(s: ConstituentState): string {
  switch (s.kind) {
    case "ok":
      return "ok";
    case "zero":
      return "current value is 0";
    case "sentinel":
      return `sentinel-sized value ${s.value}`;
    case "formerly-present":
      return `formerly present (last value ${s.lastValue ?? "NULL"}, now retracted)`;
    case "never-present":
      return "never present";
  }
}

// ─── Fresh eval / cleanup ───────────────────────────────────────────

let evalFailures = 0;

async function freshEval(
  loader: LoaderRow,
): Promise<Map<string, number> | null> {
  try {
    const result = await EvalExecutor.run(loader.eval, loader.universe);
    return result.data;
  } catch (e) {
    console.log(
      `    [verify-skip] eval failed — ${e instanceof Error ? e.message : e}`,
    );
    evalFailures++;
    return null;
  }
}

const resurrected: string[] = [];

async function deleteAndRepair(
  loader: LoaderRow,
  dates: string[],
): Promise<number> {
  const res = await mysql`
    DELETE FROM data_points
    WHERE xseries_id = ${loader.xseries_id}
      AND data_source_id = ${loader.id}
      AND current = 1
      AND date IN ${mysql(dates)}
  `;
  await SeriesCollection.repairDataPoints({ id: loader.xseries_id });
  const promoted = await mysql<{ date: Date | string; value: number | null }>`
    SELECT date, value FROM data_points
    WHERE xseries_id = ${loader.xseries_id}
      AND current = 1
      AND date IN ${mysql(dates)}
  `;
  for (const p of promoted) {
    const line = `${loader.series_name} @ ${toDateStr(p.date)} → ${p.value}`;
    resurrected.push(line);
    console.log(`    [review] older vintage promoted to current: ${line}`);
  }
  await DataPointCollection.updatePublicDataPointsForSeries(
    loader.series_id,
    loader.universe,
  );
  return Number(
    (res as unknown as { affectedRows?: number }).affectedRows ?? dates.length,
  );
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"=".repeat(64)}`);
  console.log(
    `  Division with missing constituents  (strict ops: ${[...STRICT_OPS].join(" ")})`,
  );
  console.log(`${"=".repeat(64)}\n`);
  if (!EXECUTE) console.log("  dry run — nothing is modified\n");

  const loaders = ONLY_SERIES
    ? await mysql<LoaderRow>`
        SELECT ds.id, ds.eval, ds.series_id, s.name AS series_name,
               s.xseries_id, s.universe
        FROM data_sources ds
        JOIN series s ON s.id = ds.series_id
        WHERE ds.disabled = 0
          AND ds.eval IS NOT NULL AND ds.eval != ''
          AND (s.name = ${ONLY_SERIES} OR s.id = ${Number(ONLY_SERIES) || 0})
        ORDER BY ds.series_id, ds.id
      `
    : await mysql<LoaderRow>`
        SELECT ds.id, ds.eval, ds.series_id, s.name AS series_name,
               s.xseries_id, s.universe
        FROM data_sources ds
        JOIN series s ON s.id = ds.series_id
        WHERE ds.disabled = 0
          AND ds.eval IS NOT NULL AND ds.eval != ''
        ORDER BY ds.series_id, ds.id
      `;

  // Keep only loaders whose eval has a strict-op node we can check.
  type Checkable = LoaderRow & { refs: Set<string> };
  const checkable: Checkable[] = [];
  let withStrictOp = 0;
  let skippedAll = 0;
  let parseFailures = 0;

  for (const l of loaders) {
    let ast: EvalNode;
    try {
      ast = EvalParser.parse(l.eval);
    } catch {
      parseFailures++;
      continue;
    }
    const divisions: { refs: Set<string>; skipped: string | null }[] = [];
    strictDivisions(ast, divisions);
    if (!divisions.length) continue;
    withStrictOp++;
    const refs = new Set<string>();
    for (const d of divisions)
      if (!d.skipped) for (const r of d.refs) refs.add(r);
    if (!refs.size) {
      skippedAll++;
      if (VERBOSE) {
        console.log(
          `  [skip] loader ${l.id} (${l.series_name}): ${divisions.map((d) => d.skipped).join("; ")}`,
        );
      }
      continue;
    }
    checkable.push({ ...l, refs });
    if (checkable.length >= LIMIT) break;
  }

  console.log(
    `Loaders: ${loaders.length} enabled with evals · ${withStrictOp} contain a strict op · ` +
      `${skippedAll} skipped (transformed/external) · ${parseFailures} unparsable · ` +
      `${checkable.length} to check\n`,
  );

  let affectedLoaders = 0;
  let totalMissing = 0;
  let totalZero = 0;
  let totalSentinel = 0;
  let totalDeleted = 0;
  let unresolvedConstituents = 0;

  for (const loader of checkable) {
    const constituents: { name: string; data: ConstituentData }[] = [];
    let unresolved = false;
    for (const name of loader.refs) {
      const data = await loadConstituent(name, loader.universe);
      if (!data) {
        unresolved = true;
        unresolvedConstituents++;
        if (VERBOSE) {
          console.log(
            `  [skip] loader ${loader.id} (${loader.series_name}): constituent ${name} not found in ${loader.universe}`,
          );
        }
        break;
      }
      constituents.push({ name, data });
    }
    if (unresolved) continue;

    const target = await mysql<PointRow>`
      SELECT date, value, current FROM data_points
      WHERE xseries_id = ${loader.xseries_id}
        AND data_source_id = ${loader.id}
        AND current = 1
        AND value IS NOT NULL
    `;

    const missing: Suspect[] = [];
    const zeros: Suspect[] = [];
    const sentinels: Suspect[] = [];
    for (const p of target) {
      const date = toDateStr(p.date);
      const reasons: Suspect["reasons"] = [];
      let hasMissing = false;
      let hasZero = false;
      let hasSentinel = false;
      for (const c of constituents) {
        const state = classify(c.data, date);
        if (state.kind === "ok") continue;
        reasons.push({ name: c.name, state });
        if (state.kind === "never-present" || state.kind === "formerly-present")
          hasMissing = true;
        else if (state.kind === "zero") hasZero = true;
        else hasSentinel = true;
      }
      const s: Suspect = { date, value: Number(p.value), reasons };
      if (hasMissing) missing.push(s);
      else if (hasSentinel) sentinels.push(s);
      else if (hasZero) zeros.push(s);
    }

    if (!missing.length && !zeros.length && !sentinels.length) continue;
    affectedLoaders++;

    console.log(
      `  Loader ${loader.id} → ${loader.series_name} (${loader.universe})`,
    );
    console.log(
      `    eval: ${loader.eval.length > 90 ? loader.eval.slice(0, 87) + "…" : loader.eval}`,
    );
    console.log(
      `    constituents: ${[...loader.refs].join(", ")} · target points: ${target.length}`,
    );

    // ── Primary finding: missing constituent ──
    let confirmed = missing;
    if (missing.length) {
      const never = missing.filter((m) =>
        m.reasons.some((r) => r.state.kind === "never-present"),
      ).length;
      const formerly = missing.length - never;
      console.log(
        `    MISSING constituent on ${missing.length} date(s): ${never} never-present, ${formerly} formerly-present`,
      );
      if (VERIFY) {
        const fresh = await freshEval(loader);
        if (fresh) {
          confirmed = missing.filter(
            (m) =>
              !fresh.has(m.date) || !approxEqual(fresh.get(m.date)!, m.value),
          );
          const still = missing.length - confirmed.length;
          console.log(
            `    verified: ${confirmed.length} not reproduced by a fresh eval` +
              (still
                ? `, ${still} still reproduced (kept — eval tolerates the gap?)`
                : ""),
          );
        } else {
          confirmed = [];
        }
      }
      totalMissing += confirmed.length;

      const show = VERBOSE ? confirmed : confirmed.slice(0, 5);
      for (const m of show) {
        console.log(
          `      ${m.date}  value=${m.value}  ← ${m.reasons.map((r) => `${r.name}: ${describe(r.state)}`).join("; ")}`,
        );
      }
      if (!VERBOSE && confirmed.length > show.length) {
        console.log(
          `      … ${confirmed.length - show.length} more (use --verbose)`,
        );
      }

      if (EXECUTE && confirmed.length) {
        const n = await deleteAndRepair(
          loader,
          confirmed.map((m) => m.date),
        );
        totalDeleted += n;
        console.log(
          `    → deleted ${n} current data point(s), repaired, public synced`,
        );
      }
    }

    // ── Secondary signals (report only) ──
    if (sentinels.length) {
      totalSentinel += sentinels.length;
      const ex = sentinels[0];
      console.log(
        `    [sentinel] ${sentinels.length} date(s) where a constituent holds a sentinel-sized value ` +
          `(e.g. ${ex.date}: ${ex.reasons.map((r) => `${r.name}=${(r.state as { value: number }).value}`).join(", ")}) ` +
          `→ run cleanup-bea-false-zeros.ts on the constituent, then --derived`,
      );
    }
    if (zeros.length) {
      totalZero += zeros.length;
      const ex = zeros[0];
      console.log(
        `    [zero] ${zeros.length} date(s) where a constituent is exactly 0 ` +
          `(e.g. ${ex.date}: ${ex.reasons.map((r) => r.name).join(", ")}) — false zero or zero denominator?`,
      );
    }
    console.log();
  }

  console.log(`${"─".repeat(64)}`);
  console.log(`Summary`);
  console.log(`  loaders checked:                  ${checkable.length}`);
  console.log(`  loaders with findings:            ${affectedLoaders}`);
  console.log(
    `  points with MISSING constituent:  ${totalMissing}${VERIFY ? " (verified)" : " (unverified — add --verify)"}`,
  );
  console.log(
    `  points with sentinel constituent: ${totalSentinel}  (report only)`,
  );
  console.log(
    `  points with zero constituent:     ${totalZero}  (report only)`,
  );
  if (unresolvedConstituents)
    console.log(
      `  loaders skipped, constituent not found: ${unresolvedConstituents}`,
    );
  if (evalFailures)
    console.log(`  fresh-eval failures:              ${evalFailures}`);
  if (EXECUTE) {
    console.log(`  data points deleted:              ${totalDeleted}`);
    if (resurrected.length) {
      console.log(`\n  Older vintages promoted to current — review these:`);
      for (const r of resurrected) console.log(`    ${r}`);
    }
  } else if (totalMissing) {
    console.log(`\n  Re-run with --execute to delete the confirmed rows.`);
  }
  console.log();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
