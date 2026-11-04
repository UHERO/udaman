/**
 * Adds the DOTAX universe's extract loaders to the UHERO series that load
 * the same DOTAX data through the old downloads (tax_collec / tax_GE
 * files, rparsed/dotax.csv, dotax_preliminary_data.xls).
 *
 * Matching is by value, not name: UHERO names and data portal names drift
 * from DOTAX's. For each DOTAX monthly series the script computes what its
 * loaders would load (the extracts, in memory; nothing is reloaded) and
 * compares that to each candidate UHERO series' current data points from
 * those downloads (points from other loaders, like the hand-kept
 * tax_hist_new.xls history, are not compared). Only DOTAX series in the
 * same geography are considered. The same-named one matches if at most
 * MAX_MISS of the months both have differ (zeros count: some county
 * lines are all zeros; one-month differences are real, e.g. UHERO's
 * special Aug2017 GE sheet). Otherwise the match is the series agreeing
 * on the most nonzero months, at least MIN_AGREE of them and MIN_SHARE of
 * the nonzero months both have. A tie is reported as ambiguous and left
 * alone.
 *
 * A matched UHERO series gets copies of the DOTAX series' load_from_extract
 * loaders (same eval, scale and priority: the dotax_sheet loaders on top
 * where DOTAX has them). Its other loaders keep their order but step down
 * below the new ones. Nothing is disabled or reloaded. Idempotent: loaders
 * are keyed on their eval.
 *
 * Usage: bun run scripts/create-uhero-dotax-loaders.ts [--dry-run] [--verbose]
 */
import LoaderCollection from "@catalog/collections/loader-collection";
import type { Universe } from "@catalog/types/shared";
import EvalExecutor from "@catalog/utils/eval-executor";

import { rawQuery } from "@/lib/mysql/db";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const UHERO: Universe = "UHERO";
const DOTAX: Universe = "DOTAX";
const LOAD_METHOD = "load_from_extract";
/** UHERO loaders that read the DOTAX files the extracts parse. */
const OLD_SOURCES = /tax_collec|tax_GE|dotax/;
/** Nonzero months that must agree, and their share of compared months. */
const MIN_AGREE = 12;
const MIN_SHARE = 0.95;
/** Same name: the share of shared months that may differ (at least one). */
const MAX_MISS = 0.05;

type LoaderSpec = { code: string; priority: number; scale: number };
type DotaxSeries = {
  name: string;
  portalName: string | null;
  loaders: LoaderSpec[];
  data: Map<string, number>;
};
type Candidate = {
  id: number;
  name: string;
  portalName: string | null;
  data: Map<string, number>;
};
type Match = {
  uhero: Candidate;
  dotax: DotaxSeries;
  agree: number;
  compared: number;
  overlap: number;
  miss: number;
};

const ymd = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

/** Equal at the stored precision (round6 of thousands), with float slack. */
const same = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.001, 1e-6 * Math.abs(b));

/**
 * DOTAX monthly series whose enabled loaders are all load_from_extract,
 * with the data those loaders would load (higher priority wins a month,
 * as in SeriesCollection.updateData).
 */
async function dotaxSeries(): Promise<{
  series: DotaxSeries[];
  skipped: string[];
}> {
  const rows = await rawQuery<{
    name: string;
    dataPortalName: string | null;
    eval: string;
    priority: number;
    scale: string;
  }>(
    `SELECT s.name, s.dataPortalName, ds.eval, ds.priority, ds.scale
     FROM series s JOIN data_sources ds ON ds.series_id = s.id
     WHERE s.universe = ? AND s.name LIKE '%.M' AND NOT ds.disabled
     ORDER BY s.name, ds.priority DESC, ds.id`,
    [DOTAX],
  );
  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byName.get(r.name) ?? [];
    list.push(r);
    byName.set(r.name, list);
  }

  const series: DotaxSeries[] = [];
  const skipped: string[] = [];
  for (const [name, loaders] of byName) {
    if (!loaders.every((l) => l.eval.includes(LOAD_METHOD))) {
      skipped.push(name);
      continue;
    }
    const data = new Map<string, number>();
    for (const l of loaders) {
      const result = await EvalExecutor.run(l.eval, DOTAX, {
        seriesName: name,
      });
      for (const [date, value] of result.scaledData(parseFloat(l.scale))) {
        if (!data.has(date) && Number.isFinite(value)) data.set(date, value);
      }
    }
    series.push({
      name,
      portalName: loaders[0].dataPortalName,
      loaders: loaders.map((l) => ({
        code: l.eval,
        priority: l.priority,
        scale: parseFloat(l.scale),
      })),
      data,
    });
  }
  return { series, skipped };
}

/** UHERO monthly series with a loader on the old DOTAX files. */
async function candidates(): Promise<Candidate[]> {
  const series = await rawQuery<{
    id: number;
    name: string;
    dataPortalName: string | null;
    xseries_id: number;
  }>(
    `SELECT DISTINCT s.id, s.name, s.dataPortalName, s.xseries_id
     FROM series s JOIN data_sources ds ON ds.series_id = s.id
     WHERE s.universe = ? AND s.name LIKE '%.M'
       AND ds.eval REGEXP ?
     ORDER BY s.name`,
    [UHERO, OLD_SOURCES.source],
  );
  const out: Candidate[] = [];
  for (const s of series) {
    const points = await rawQuery<{ date: Date; value: number | null }>(
      `SELECT dp.date, dp.value FROM data_points dp
       JOIN data_sources ds ON ds.id = dp.data_source_id
       WHERE dp.xseries_id = ? AND dp.current = 1 AND ds.eval REGEXP ?`,
      [s.xseries_id, OLD_SOURCES.source],
    );
    const data = new Map<string, number>();
    for (const p of points)
      if (p.value != null) data.set(ymd(p.date), Number(p.value));
    out.push({
      id: s.id,
      name: s.name,
      portalName: s.dataPortalName,
      data,
    });
  }
  return out;
}

/** "TRGTNS@HON.M" → "HON" */
const geoOf = (name: string) => name.split("@")[1]?.split(".")[0];

/**
 * Months both have (overlap) and how many differ (miss); of the nonzero
 * ones (compared), how many agree.
 */
function score(u: Map<string, number>, d: Map<string, number>) {
  let agree = 0;
  let compared = 0;
  let overlap = 0;
  let miss = 0;
  for (const [date, uv] of u) {
    const dv = d.get(date);
    if (dv === undefined) continue;
    overlap++;
    const ok = same(uv, dv);
    if (!ok) miss++;
    if (uv === 0 && dv === 0) continue;
    compared++;
    if (ok) agree++;
  }
  return { agree, compared, overlap, miss };
}

function matchAll(cands: Candidate[], dotax: DotaxSeries[]) {
  const matched: Match[] = [];
  const ambiguous: { uhero: Candidate; options: Match[] }[] = [];
  const unmatched: { uhero: Candidate; best: Match | null }[] = [];
  for (const u of cands) {
    let best: Match[] = [];
    let nearest: Match | null = null;
    let sameName: Match | null = null;
    for (const d of dotax) {
      if (geoOf(d.name) !== geoOf(u.name)) continue;
      const m = { uhero: u, dotax: d, ...score(u.data, d.data) };
      if (!nearest || m.agree > nearest.agree) nearest = m;
      if (
        d.name === u.name &&
        m.overlap > 0 &&
        m.miss <= Math.max(1, MAX_MISS * m.overlap)
      )
        sameName = m;
      if (m.agree < MIN_AGREE || m.agree < MIN_SHARE * m.compared) continue;
      if (!best.length || m.agree > best[0].agree) best = [m];
      else if (m.agree === best[0].agree) best.push(m);
    }
    if (sameName) best = [sameName];
    if (best.length === 1) matched.push(best[0]);
    else if (best.length > 1) ambiguous.push({ uhero: u, options: best });
    else unmatched.push({ uhero: u, best: nearest });
  }
  return { matched, ambiguous, unmatched };
}

/**
 * Add the DOTAX loaders the series lacks (fixing a drifted scale or
 * priority on ones it has) and step its other loaders down below them,
 * keeping their order.
 */
async function applyLoaders(seriesId: number, want: LoaderSpec[]) {
  const existing = await LoaderCollection.getBySeriesId(seriesId);
  const wanted = new Set(want.map((w) => w.code));
  const others = existing.filter((l) => !wanted.has(l.eval ?? ""));
  const floor = Math.min(...want.map((w) => w.priority));
  const top = Math.max(...others.map((l) => l.priority ?? 0), -Infinity);
  const shift = others.length ? Math.max(0, top - floor + 10) : 0;
  let created = 0;
  let updated = 0;

  if (!DRY_RUN) {
    for (const l of others)
      if (shift)
        await LoaderCollection.update(l.id, {
          priority: (l.priority ?? 0) - shift,
        });
  }
  for (const w of want) {
    const found = existing.find((l) => l.eval === w.code);
    if (found) {
      if (parseFloat(found.scale) === w.scale && found.priority === w.priority)
        continue;
      updated++;
      if (!DRY_RUN)
        await LoaderCollection.update(found.id, {
          scale: String(w.scale),
          priority: w.priority,
        });
      continue;
    }
    created++;
    if (!DRY_RUN)
      await LoaderCollection.create({
        seriesId,
        code: w.code,
        priority: w.priority,
        scale: w.scale,
        presaveHook: "",
        clearBeforeLoad: false,
        pseudoHistory: false,
        universe: UHERO,
      });
  }
  return { created, updated, shifted: shift ? others.length : 0, shift };
}

async function main() {
  const { series: dotax, skipped } = await dotaxSeries();
  const cands = await candidates();
  console.log(
    `DOTAX: ${dotax.length} monthly extract series (${skipped.length} with other loaders left out: ${skipped.join(", ")})`,
  );
  console.log(`UHERO: ${cands.length} monthly series on the old DOTAX files`);

  const { matched, ambiguous, unmatched } = matchAll(cands, dotax);
  const renamed = matched.filter((m) => m.dotax.name !== m.uhero.name);
  console.log(
    `Matched ${matched.length} (${renamed.length} under another name), ambiguous ${ambiguous.length}, unmatched ${unmatched.length}`,
  );

  if (renamed.length) {
    console.log("\nMatched under another name (UHERO ← DOTAX):");
    for (const m of renamed)
      console.log(
        `  ${m.uhero.name.padEnd(16)} ← ${m.dotax.name.padEnd(16)} ${m.agree}/${m.compared}  "${m.uhero.portalName ?? ""}" / "${m.dotax.portalName ?? ""}"`,
      );
  }
  if (ambiguous.length) {
    console.log("\nAmbiguous (left alone):");
    for (const a of ambiguous)
      console.log(
        `  ${a.uhero.name.padEnd(16)} ${a.options.map((m) => `${m.dotax.name} ${m.agree}/${m.compared}`).join(", ")}`,
      );
  }
  const short = matched
    .map((m) => ({
      m,
      missing: [...m.uhero.data.keys()]
        .filter((d) => !m.dotax.data.has(d))
        .sort(),
    }))
    .filter((x) => x.missing.length);
  if (short.length) {
    console.log(
      "\nMatched, but the extracts lack months UHERO loads from the downloads (its other loaders keep them):",
    );
    for (const { m, missing } of short)
      console.log(
        `  ${m.uhero.name.padEnd(16)} ← ${m.dotax.name.padEnd(16)} ${missing.length} months, ${missing[0]} … ${missing.at(-1)}`,
      );
  }
  if (unmatched.length) {
    console.log("\nUnmatched (nearest DOTAX series):");
    for (const { uhero, best } of unmatched)
      console.log(
        `  ${uhero.name.padEnd(16)} ${uhero.data.size} pts  ${best && best.agree ? `${best.dotax.name} ${best.agree}/${best.compared}` : "-"}`,
      );
  }

  let created = 0;
  let updated = 0;
  let shifted = 0;
  if (VERBOSE) console.log("\nLoaders:");
  for (const m of matched) {
    const r = await applyLoaders(m.uhero.id, m.dotax.loaders);
    created += r.created;
    updated += r.updated;
    shifted += r.shifted;
    if (VERBOSE && (r.created || r.updated || r.shifted)) {
      console.log(
        `  ${m.uhero.name}${r.shift ? ` (other loaders -${r.shift})` : ""}`,
      );
      for (const l of m.dotax.loaders)
        console.log(`    ${l.priority}  ${l.code}`);
    }
  }
  console.log(
    `\n${DRY_RUN ? "Would create" : "Created"} ${created} loaders, ${DRY_RUN ? "would update" : "updated"} ${updated}, ${DRY_RUN ? "would step down" : "stepped down"} ${shifted} existing loaders.`,
  );
  if (!DRY_RUN)
    console.log(
      "Loaders have not been run; reload the UHERO series to load from the extracts.",
    );
  process.exit(0);
}

// Top-level await: with a floating promise Bun can exit 0 mid-query.
try {
  await main();
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}
