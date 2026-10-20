/**
 * Shared steps for moving one API source's load statements from its legacy
 * load method (Series.load_api_bls(...), …) to load_from_extract, one
 * source at a time and verified by diff. Each scripts/migrate-api/<source>.ts
 * supplies the legacy method names and a converter; this does the rest.
 *
 *   bun run scripts/migrate-api/bls.ts <command> [flags]
 *
 * Commands, in order:
 *   plan     List every enabled loader that calls the legacy method and
 *            what it becomes (or why it can't be converted). Read-only.
 *   stage    Add the converted filters to the downloader's
 *            config.extraFilters, so its next fetch asks for them before
 *            any load statement does. Writes with --execute.
 *            Then: bun run ingest fetch <source>   (fetch extracts too)
 *   check    Run each converted statement against the latest extract
 *            (no data written) and compare with the data points the legacy
 *            loader stored, as a reload would (values rounded to 6
 *            places). Writes a CSV report to DATA_DIR/migrations/.
 *   execute  Rewrite the loaders that passed the check, in place (same
 *            loader id, so the next reload sees identical values and adds
 *            nothing). Backs up the old evals to DATA_DIR/backup/ first,
 *            then drops the staged extraFilters the load statements now
 *            ask for themselves. Writes with --execute; --force also
 *            rewrites loaders whose values differ.
 *   restore <backup.csv>
 *            Put the old evals back (only on loaders still holding the
 *            converted eval). Writes with --execute.
 *
 * Flags: --series=NAME (one series, for trying it out), --verbose,
 * --live (check/execute: compare with a fresh run of the legacy statement
 * instead of the stored points. Stored points are only as fresh as the
 * last reload, so a revision since then shows as `differs`; --live tells
 * the two apart. It calls the API once per loader, as a reload does: fine
 * for FRED, EIA and e-Stat, slow for BEA, and over BLS's daily request
 * limit for all of BLS, so use it there with --series).
 *
 * `drops` leaves the old dates' data points in place (a reload never
 * deletes points the statement no longer returns, unless the loader
 * clears first), so --force is reasonable when the missing dates are ones
 * the source no longer publishes.
 *
 * Check outcomes per loader:
 *   same      every date and value agrees
 *   adds      agrees where both have the date; the extract has more dates
 *   unloaded  the legacy loader has no data points to compare with
 *   drops     the legacy loader has dates the extract lacks
 *   differs   some date has another value
 *   error     the converted statement fails (no extract, no match, …)
 * same, adds and unloaded pass. Disabled loaders are never touched.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import DataDownloaderCollection from "@catalog/collections/data-downloader-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import EvalParser from "@catalog/utils/eval-parser";
import type { EvalArg } from "@catalog/utils/eval-parser";

import { referencedFilters } from "@/core/ingest/references";
import { getDataDir } from "@/lib/data-dir";
import { rawQuery } from "@/lib/mysql/db";

export type Filters = Record<string, string>;
export type Conversion =
  { ok: true; filters: Filters } | { ok: false; reason: string };

/** A legacy call's arguments: positional values and merged options. */
export type LegacyCall = {
  method: string;
  positional: string[];
  options: Record<string, string>;
};

export interface MigrationSpec {
  /** Extractor (and downloader) handle: "bls" */
  handle: string;
  /** Legacy static methods, as written in evals: "load_api_bls" */
  methods: string[];
  convert(call: LegacyCall): Conversion;
}

// ─── Arguments ───────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const argVal = (name: string) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

export const ok = (filters: Filters): Conversion => ({ ok: true, filters });
export const fail = (reason: string): Conversion => ({ ok: false, reason });

/** Options keys outside `allowed`, for an "unsupported argument" failure. */
export function unknownKeys(
  options: Record<string, string>,
  allowed: string[],
): string[] {
  return Object.keys(options).filter((k) => !allowed.includes(k));
}

// ─── Rewriting evals ─────────────────────────────────────────────────

type CallSpan = { start: number; end: number; method: string; text: string };

/** Every `Series.<method>(…)` in an eval, with its text span. */
function findCalls(evalStr: string, methods: string[]): CallSpan[] {
  const names = [...methods].sort((a, b) => b.length - a.length);
  const re = new RegExp(`Series\\.(${names.join("|")})\\(`, "g");
  const out: CallSpan[] = [];
  for (let m = re.exec(evalStr); m; m = re.exec(evalStr)) {
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = m.index + m[0].length - 1; i < evalStr.length; i++) {
      const c = evalStr[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "(") depth++;
      else if (c === ")" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end < 0) continue;
    out.push({
      start: m.index,
      end,
      method: m[1],
      text: evalStr.slice(m.index, end),
    });
    re.lastIndex = end;
  }
  return out;
}

function argValue(a: EvalArg): string | null {
  if (a.type === "string" || a.type === "symbol") return a.value;
  if (a.type === "number") return String(a.value);
  return null;
}

function parseCall(span: CallSpan): LegacyCall | string {
  let node;
  try {
    node = EvalParser.parse(span.text);
  } catch (e) {
    return `does not parse: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (node.type !== "static_method") return "not a plain call";
  const positional: string[] = [];
  const options: Record<string, string> = {};
  for (const a of node.args) {
    if (a.type === "options") {
      for (const [k, v] of Object.entries(a.value)) options[k] = String(v);
      continue;
    }
    const v = argValue(a);
    if (v === null) return `argument of type ${a.type} is not supported`;
    positional.push(v);
  }
  return { method: span.method, positional, options };
}

export function extractCallText(handle: string, filters: Filters): string {
  const args = Object.entries(filters)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  return `Series.load_from_extract(${JSON.stringify(handle)}, { ${args} })`;
}

type Rewrite =
  | { ok: true; eval: string; filters: Filters[] }
  | { ok: false; reason: string };

/** The eval with every legacy call replaced, or why it can't be. */
export function rewriteEval(spec: MigrationSpec, evalStr: string): Rewrite {
  const spans = findCalls(evalStr, spec.methods);
  if (spans.length === 0) return { ok: false, reason: "no legacy call found" };
  let out = evalStr;
  const filters: Filters[] = [];
  for (const span of [...spans].reverse()) {
    const call = parseCall(span);
    if (typeof call === "string") return { ok: false, reason: call };
    const c = spec.convert(call);
    if (!c.ok) return { ok: false, reason: `${span.text}: ${c.reason}` };
    filters.unshift(c.filters);
    out =
      out.slice(0, span.start) +
      extractCallText(spec.handle, c.filters) +
      out.slice(span.end);
  }
  return { ok: true, eval: out, filters };
}

// ─── Loaders ─────────────────────────────────────────────────────────

type LoaderRow = {
  id: number;
  series_id: number | null;
  xseries_id: number | null;
  name: string | null;
  universe: string;
  eval: string;
  scale: string;
};

async function legacyLoaders(spec: MigrationSpec): Promise<LoaderRow[]> {
  const series = argVal("series");
  const rows = await rawQuery<LoaderRow>(
    `SELECT ds.id, ds.series_id, s.xseries_id, s.name, ds.universe, ds.eval, ds.scale
     FROM data_sources ds
     LEFT JOIN series s ON s.id = ds.series_id
     WHERE NOT ds.disabled AND ds.eval REGEXP ?
       ${series ? "AND s.name = ?" : ""}
     ORDER BY s.name, ds.id`,
    [`Series\\.(${spec.methods.join("|")})\\(`, ...(series ? [series] : [])],
  );
  return rows;
}

type Planned = LoaderRow & { rewrite: Rewrite };

async function plan(spec: MigrationSpec): Promise<Planned[]> {
  const rows = await legacyLoaders(spec);
  return rows.map((r) => ({ ...r, rewrite: rewriteEval(spec, r.eval) }));
}

// ─── Filters ─────────────────────────────────────────────────────────

const filterKey = (f: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(f)
      .map(([k, v]) => [k, String(v)])
      .sort(),
  );

function configFilters(config: Record<string, unknown>): Filters[] {
  const extra = config.extraFilters;
  return Array.isArray(extra)
    ? extra.filter(
        (f): f is Filters => !!f && typeof f === "object" && !Array.isArray(f),
      )
    : [];
}

// ─── Check ───────────────────────────────────────────────────────────

type Outcome = "same" | "adds" | "unloaded" | "drops" | "differs" | "error";
const PASSING: Outcome[] = ["same", "adds", "unloaded"];

type Checked = Planned & {
  outcome: Outcome;
  detail: string;
  newEval: string;
};

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Latest stored value per date of this loader (as updateData reads it). */
async function storedPoints(r: LoaderRow): Promise<Map<string, number>> {
  const rows = await rawQuery<{ d: string; value: number | null }>(
    `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS d, value FROM data_points
     WHERE xseries_id = ? AND data_source_id = ?
     ORDER BY created_at DESC`,
    [r.xseries_id ?? 0, r.id],
  );
  const seen = new Set<string>();
  const out = new Map<string, number>();
  for (const row of rows) {
    if (seen.has(row.d)) continue;
    seen.add(row.d);
    if (row.value !== null) out.set(row.d, Number(row.value));
  }
  return out;
}

async function checkOne(r: Planned): Promise<Checked> {
  if (!r.rewrite.ok)
    return { ...r, outcome: "error", detail: r.rewrite.reason, newEval: "" };
  const newEval = r.rewrite.eval;
  let fresh: Map<string, number>;
  try {
    const result = await EvalExecutor.run(newEval, r.universe, {
      seriesName: r.name,
    });
    fresh = result.scaledData(parseFloat(r.scale));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...r, outcome: "error", detail: msg, newEval };
  }
  let old: Map<string, number>;
  if (flag("live")) {
    try {
      const legacy = await EvalExecutor.run(r.eval, r.universe, {
        seriesName: r.name,
      });
      old = legacy.scaledData(parseFloat(r.scale));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...r, outcome: "error", detail: `legacy: ${msg}`, newEval };
    }
  } else old = await storedPoints(r);
  if (old.size === 0)
    return {
      ...r,
      outcome: "unloaded",
      detail: `${flag("live") ? "the legacy statement returns nothing" : "no stored points"}; extract has ${fresh.size} dates`,
      newEval,
    };

  const differs: string[] = [];
  const dropped: string[] = [];
  for (const [date, v] of old) {
    const w = fresh.get(date);
    if (w === undefined) dropped.push(date);
    else if (round6(v) !== round6(w)) differs.push(`${date}: ${v} -> ${w}`);
  }
  const oldDates = [...old.keys()].sort();
  const added = [...fresh.keys()].filter((d) => !old.has(d));
  const before = added.filter((d) => d < oldDates[0]).length;
  const after = added.filter((d) => d > oldDates[oldDates.length - 1]).length;
  const inside = added.length - before - after;

  const parts: string[] = [];
  if (differs.length)
    parts.push(
      `${differs.length} value(s) differ (${differs.slice(0, 3).join("; ")}${differs.length > 3 ? "; …" : ""})`,
    );
  if (dropped.length)
    parts.push(
      `${dropped.length} date(s) missing from the extract (${dropped[0]}${dropped.length > 1 ? ` … ${dropped[dropped.length - 1]}` : ""})`,
    );
  if (added.length)
    parts.push(
      `adds ${[
        before && `${before} before`,
        inside && `${inside} inside`,
        after && `${after} after`,
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  const outcome: Outcome = differs.length
    ? "differs"
    : dropped.length
      ? "drops"
      : added.length
        ? "adds"
        : "same";
  return {
    ...r,
    outcome,
    detail: parts.join("; ") || `${old.size} dates agree`,
    newEval,
  };
}

async function check(spec: MigrationSpec): Promise<Checked[]> {
  const planned = await plan(spec);
  const out: Checked[] = [];
  for (const [i, r] of planned.entries()) {
    out.push(await checkOne(r));
    if ((i + 1) % 100 === 0)
      console.log(`  checked ${i + 1}/${planned.length}`);
  }
  return out;
}

// ─── CSV ─────────────────────────────────────────────────────────────

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

function writeFile(dir: string, name: string, lines: string[]): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}

// ─── Commands ────────────────────────────────────────────────────────

function summarize<T>(items: T[], key: (t: T) => string): string {
  const counts = new Map<string, number>();
  for (const t of items) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${k} ${n}`).join(", ");
}

async function cmdPlan(spec: MigrationSpec) {
  const planned = await plan(spec);
  const bad = planned.filter((p) => !p.rewrite.ok);
  console.log(
    `${planned.length} enabled loader(s) call ${spec.methods.join(" / ")}: ${planned.length - bad.length} convertible, ${bad.length} not`,
  );
  const show = flag("verbose") ? planned : planned.slice(0, 5);
  for (const p of show.filter((p) => p.rewrite.ok))
    console.log(
      `  ${p.name}\n    ${p.eval}\n    ${(p.rewrite as { eval: string }).eval}`,
    );
  for (const p of bad)
    console.log(
      `  NOT CONVERTIBLE ${p.name} (#${p.id}): ${(p.rewrite as { reason: string }).reason}`,
    );
}

async function cmdStage(spec: MigrationSpec) {
  const planned = await plan(spec);
  const downloader = await DataDownloaderCollection.getByHandle(spec.handle);
  const existing = configFilters(downloader.config);
  const referenced = new Set(
    (await referencedFilters([spec.handle])).map(filterKey),
  );
  const merged = new Map(existing.map((f) => [filterKey(f), f]));
  let added = 0;
  for (const p of planned) {
    if (!p.rewrite.ok) continue;
    for (const f of p.rewrite.filters) {
      const k = filterKey(f);
      if (referenced.has(k) || merged.has(k)) continue;
      merged.set(k, f);
      added++;
    }
  }
  console.log(
    `${spec.handle}: ${added} filter(s) to stage (${existing.length} already in config.extraFilters, ${merged.size} after)`,
  );
  if (!flag("execute")) {
    console.log(
      "Dry run: rerun with --execute to write the downloader config.",
    );
    return;
  }
  await DataDownloaderCollection.update(downloader.id, {
    config: { ...downloader.config, extraFilters: [...merged.values()] },
  });
  console.log(
    `Staged. Next: bun run ingest fetch ${spec.handle}   (it extracts when it stores something new), then the check command.`,
  );
}

async function cmdCheck(spec: MigrationSpec): Promise<Checked[]> {
  const checked = await check(spec);
  const path = writeFile(
    join(getDataDir(), "migrations"),
    `${spec.handle}-check-${stamp()}.csv`,
    [
      csvRow(["loader_id", "series", "outcome", "detail", "eval", "new_eval"]),
      ...checked.map((c) =>
        csvRow([c.id, c.name, c.outcome, c.detail, c.eval, c.newEval]),
      ),
    ],
  );
  console.log(
    `${checked.length} loader(s): ${summarize(checked, (c) => c.outcome)}`,
  );
  const failing = checked.filter((c) => !PASSING.includes(c.outcome));
  for (const c of flag("verbose") ? checked : failing.slice(0, 40))
    console.log(`  ${c.outcome.padEnd(8)} ${c.name} (#${c.id}): ${c.detail}`);
  if (!flag("verbose") && failing.length > 40)
    console.log(`  … ${failing.length - 40} more in the report`);
  console.log(`Report: ${path}`);
  return checked;
}

async function cmdExecute(spec: MigrationSpec) {
  const checked = await cmdCheck(spec);
  const force = flag("force");
  const chosen = checked.filter(
    (c) =>
      c.newEval &&
      (PASSING.includes(c.outcome) ||
        (force && (c.outcome === "differs" || c.outcome === "drops"))),
  );
  const held = checked.length - chosen.length;
  console.log(
    `\n${chosen.length} loader(s) to rewrite; ${held} held back${force ? "" : " (--force also rewrites differs / drops)"}`,
  );
  if (!flag("execute")) {
    console.log("Dry run: rerun with --execute to rewrite them.");
    return;
  }
  if (chosen.length === 0) return;

  const backup = writeFile(
    join(getDataDir(), "backup"),
    `${spec.handle}-loaders-before-load_from_extract-${stamp()}.csv`,
    [
      csvRow(["loader_id", "series", "old_eval", "new_eval"]),
      ...chosen.map((c) => csvRow([c.id, c.name, c.eval, c.newEval])),
    ],
  );
  console.log(`Backup: ${backup}`);

  let rewritten = 0;
  for (const c of chosen) {
    const [row] = await rawQuery<{ eval: string }>(
      "SELECT eval FROM data_sources WHERE id = ?",
      [c.id],
    );
    if (row?.eval !== c.eval) {
      console.log(`  skipped ${c.name} (#${c.id}): its eval changed meanwhile`);
      continue;
    }
    try {
      await LoaderCollection.update(c.id, { eval: c.newEval });
      rewritten++;
    } catch (e) {
      console.log(
        `  FAILED ${c.name} (#${c.id}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  console.log(`Rewrote ${rewritten} loader(s).`);

  // The load statements now ask for these themselves.
  const downloader = await DataDownloaderCollection.getByHandle(spec.handle);
  const existing = configFilters(downloader.config);
  if (existing.length) {
    const referenced = new Set(
      (await referencedFilters([spec.handle])).map(filterKey),
    );
    const kept = existing.filter((f) => !referenced.has(filterKey(f)));
    if (kept.length !== existing.length) {
      const { extraFilters: _, ...rest } = downloader.config;
      await DataDownloaderCollection.update(downloader.id, {
        config: kept.length ? { ...rest, extraFilters: kept } : rest,
      });
      console.log(
        `Dropped ${existing.length - kept.length} staged filter(s); ${kept.length} left in config.extraFilters.`,
      );
    }
  }
  console.log(
    "Reload the rewritten series (or wait for the nightly reload): unchanged values add no data points.",
  );
}

async function cmdRestore(file: string | undefined) {
  if (!file || !existsSync(file))
    throw new Error("restore needs the backup CSV path");
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8")).filter(
    (r) => r.length > 1,
  );
  const col = (name: string) => header.indexOf(name);
  const [iId, iOld, iNew, iName] = [
    col("loader_id"),
    col("old_eval"),
    col("new_eval"),
    col("series"),
  ];
  if ([iId, iOld, iNew].some((i) => i < 0))
    throw new Error(`${file} is not a migration backup`);
  let restored = 0;
  let skipped = 0;
  for (const r of rows) {
    const id = Number(r[iId]);
    const [row] = await rawQuery<{ eval: string }>(
      "SELECT eval FROM data_sources WHERE id = ?",
      [id],
    );
    if (row?.eval !== r[iNew]) {
      console.log(
        `  skipped ${r[iName]} (#${id}): eval is no longer the converted one`,
      );
      skipped++;
      continue;
    }
    if (flag("execute"))
      await LoaderCollection.updateFields(id, { eval: r[iOld] });
    restored++;
  }
  console.log(
    `${flag("execute") ? "Restored" : "Would restore"} ${restored} loader(s), skipped ${skipped}.${flag("execute") ? "" : " Rerun with --execute."}`,
  );
}

export async function runMigration(spec: MigrationSpec): Promise<void> {
  const [command, file] = argv.filter((a) => !a.startsWith("--"));
  try {
    switch (command) {
      case "plan":
        await cmdPlan(spec);
        break;
      case "stage":
        await cmdStage(spec);
        break;
      case "check":
        await cmdCheck(spec);
        break;
      case "execute":
        await cmdExecute(spec);
        break;
      case "restore":
        await cmdRestore(file);
        break;
      default:
        console.log(
          "Usage: bun run scripts/migrate-api/<source>.ts plan | stage | check | execute | restore <backup.csv> [--execute] [--force] [--series=NAME] [--verbose]",
        );
        process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  process.exit(0);
}
