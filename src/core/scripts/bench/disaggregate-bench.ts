/**
 * Benchmark: Series.interpolate vs Series.censusInterpolate vs
 * Series.disaggregate (tempdisagg port) on real annual series from the
 * local database.
 *
 *   bun run src/core/scripts/bench/disaggregate-bench.ts [--limit 300] [--reps 7]
 */
import SeriesCollection from "@catalog/collections/series-collection";
import type Series from "@catalog/models/series";
import { mysql } from "@/lib/mysql/db";

const argv = process.argv.slice(2);
const flag = (name: string, dflt: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const LIMIT = flag("limit", 300);
const REPS = flag("reps", 7);

type Variant = { name: string; run: (s: Series) => Series };
const VARIANTS: Variant[] = [
  { name: "interpolate(:quarter)", run: (s) => s.interpolate("quarter") },
  { name: "censusInterpolate(:quarter)", run: (s) => s.censusInterpolate("quarter") },
  { name: "disaggregate denton-cholette (default)", run: (s) => s.disaggregate("quarter", { conversion: "average" }) },
  { name: "disaggregate uniform", run: (s) => s.disaggregate("quarter", { method: "uniform", conversion: "average" }) },
  { name: "disaggregate chow-lin-maxlog (no indicator)", run: (s) => s.disaggregate("quarter", { method: "chow-lin-maxlog", conversion: "average" }) },
  { name: "disaggregate denton-cholette, checkInvariant:false", run: (s) => s.disaggregate("quarter", { conversion: "average", checkInvariant: false }) },
];

function pct(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}
const fmt = (ms: number) => (ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`);

async function main() {
  const t0 = performance.now();
  const rows = await mysql<{ id: number; name: string; n: number }>`
    SELECT s.id, s.name, COUNT(*) AS n
    FROM series s
    JOIN xseries x ON x.id = s.xseries_id
    JOIN data_points d ON d.xseries_id = s.xseries_id AND d.current = 1 AND d.value IS NOT NULL
    WHERE x.frequency = 'year' AND s.name LIKE '%@HI.A'
    GROUP BY s.id, s.name
    HAVING n >= 8
    ORDER BY s.id
    LIMIT ${LIMIT}
  `;
  const series: Series[] = [];
  for (const r of rows) {
    const s = await SeriesCollection.getById(r.id);
    await SeriesCollection.loadCurrentData(s);
    series.push(s);
  }
  const tLoad = performance.now() - t0;
  const lengths = series.map((s) => s.data.size).sort((a, b) => a - b);
  console.log(
    `Loaded ${series.length} annual series in ${fmt(tLoad)} ` +
      `(points: min ${lengths[0]}, median ${pct(lengths, 0.5)}, max ${lengths.at(-1)})\n`,
  );

  // Warm-up (JIT) on every variant.
  for (const v of VARIANTS) for (const s of series.slice(0, 20)) { try { v.run(s); } catch { /* ignore */ } }

  const results: Array<{ name: string; ok: number; failed: Map<string, number>; per: number[]; total: number; byLen: Map<number, number[]> }> = [];
  for (const v of VARIANTS) {
    const per: number[] = [];
    const byLen = new Map<number, number[]>();
    const failed = new Map<string, number>();
    let ok = 0;
    let total = 0;
    for (let rep = 0; rep < REPS; rep++) {
      const tRep = performance.now();
      for (const s of series) {
        const t = performance.now();
        try {
          v.run(s);
          const dt = performance.now() - t;
          if (rep > 0) {
            per.push(dt);
            const bucket = Math.min(80, Math.ceil(s.data.size / 20) * 20);
            (byLen.get(bucket) ?? byLen.set(bucket, []).get(bucket)!).push(dt);
          }
          if (rep === 0) ok++;
        } catch (e) {
          if (rep === 0) {
            const msg = (e as Error).message.replace(/[A-Z_%$]+@\w+\.\w+/g, "X").replace(/\d{4}-\d{2}-\d{2}/g, "DATE").slice(0, 70);
            failed.set(msg, (failed.get(msg) ?? 0) + 1);
          }
        }
      }
      if (rep > 0) total += performance.now() - tRep;
    }
    results.push({ name: v.name, ok, failed, per, total: total / (REPS - 1), byLen });
  }

  console.log(`Per-call latency over ${REPS - 1} timed passes × ${series.length} series:\n`);
  const head = ["variant", "ok", "median", "p95", "max", "mean", "pass total", "series/s"];
  const table = results.map((r) => {
    const sorted = [...r.per].sort((a, b) => a - b);
    const mean = r.per.reduce((a, b) => a + b, 0) / r.per.length;
    return [r.name, `${r.ok}/${series.length}`, fmt(pct(sorted, 0.5)), fmt(pct(sorted, 0.95)), fmt(sorted.at(-1)!), fmt(mean), fmt(r.total), (r.ok / (r.total / 1000)).toFixed(0)];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...table.map((row) => row[i].length)));
  const line = (row: string[]) => row.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of table) console.log(line(row));

  console.log("\nMedian latency by series length (points ≤ bucket):");
  const buckets = [...new Set(results.flatMap((r) => [...r.byLen.keys()]))].sort((a, b) => a - b);
  console.log(["variant", ...buckets.map((b) => `≤${b}`)].map((c, i) => (i === 0 ? c.padEnd(widths[0]) : c.padStart(9))).join("  "));
  for (const r of results) {
    console.log([r.name, ...buckets.map((b) => { const v = r.byLen.get(b); return v ? fmt(pct([...v].sort((x, y) => x - y), 0.5)) : "-"; })].map((c, i) => (i === 0 ? c.padEnd(widths[0]) : c.padStart(9))).join("  "));
  }

  for (const r of results) {
    if (r.failed.size) {
      console.log(`\nFailures for ${r.name}:`);
      for (const [msg, n] of r.failed) console.log(`  ${n}× ${msg}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
