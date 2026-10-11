import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyManifest,
  planManifest,
  pruneManifest,
} from "@/core/databook/apply";
import {
  availableEditions,
  coverage,
  extractEdition,
  readIR,
  writeIR,
} from "@/core/databook/extract";
import { fetchEdition } from "@/core/databook/fetch";
import { loadHistory, publishDatabook } from "@/core/databook/history";
import { propose, readManifest, writeManifest } from "@/core/databook/manifest";
import { matchEditions, needsInterpolation } from "@/core/databook/match";
import {
  databookDir,
  indexVintages,
  latestObserved,
  vintagesPath,
  VintageWriter,
  writeLatest,
  type VintageIndex,
} from "@/core/databook/store";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("databook-cli");

/** The edition the manifest (series names, locators) is built from. */
const MANIFEST_EDITION = 2025;

function usage(): never {
  console.log(`
Usage: bun run databook <command> [options]

DBEDT Data Book → DATABOOK universe (docs/2026-10-10-databook-universe-plan.md)

  fetch    --edition Y        Download an edition's 24 workbooks to data-dir/databook/raw/
  extract  --edition Y|--all  Parse workbooks → data-dir/databook/ir/db{Y}.json
  propose                     Build/refresh the manifest (data-dir/databook/manifest/)
                              from the ${MANIFEST_EDITION} IR, keeping existing names
  match                       Match every extracted edition to manifest series →
                              data-dir/databook/vintages.csv + match-report.csv,
                              and record editions/interpolate on manifest series
  apply    [--execute] [--prune]
                              Upsert the manifest into the database (dry run by default);
                              --prune deletes DATABOOK series/measurements not in it
  history  [--execute] [--no-public-sync] [--concurrency N] [--edition Y ...] [--series NAME ...]
                              Load vintages oldest-first into data_points (dry run by default).
                              Resumable: re-running skips what is already loaded.
                              --concurrency: series loaded in parallel (default 2)
  publish                     Full public_data_points sync for DATABOOK (what the
                              dashboard/REST API read); history runs it automatically
  annual   --edition Y [--execute] [--no-public-sync]
                              New/re-issued edition: fetch, extract, match, apply, load
                              that edition's vintage. Series that exist only in editions
                              after ${MANIFEST_EDITION} are reported unmatched in
                              match-report.csv (not created yet)
`);
  process.exit(1);
}

interface Args {
  command: string;
  editions: number[];
  all: boolean;
  execute: boolean;
  publicSync: boolean;
  prune: boolean;
  concurrency?: number;
  series: string[];
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const args: Args = {
    command,
    editions: [],
    all: false,
    execute: false,
    publicSync: true,
    prune: false,
    series: [],
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    switch (a) {
      case "--edition": {
        const v = Number(rest[++i]);
        if (!Number.isInteger(v)) usage();
        args.editions.push(v);
        break;
      }
      case "--all":
        args.all = true;
        break;
      case "--execute":
        args.execute = true;
        break;
      case "--no-public-sync":
        args.publicSync = false;
        break;
      case "--prune":
        args.prune = true;
        break;
      case "--concurrency": {
        const v = Number(rest[++i]);
        if (!Number.isInteger(v) || v < 1) usage();
        args.concurrency = v;
        break;
      }
      case "--series": {
        const v = rest[++i];
        if (!v) usage();
        args.series.push(v);
        break;
      }
      default:
        console.error(`Unknown option: ${a}`);
        usage();
    }
  }
  return args;
}

/** Match every extracted edition to the manifest; write vintages + report. */
function runMatch(): void {
  const manifest = readManifest();
  if (!manifest.length) throw new Error("No manifest — run propose first");
  const editions = availableEditions(2002);
  if (!editions.includes(MANIFEST_EDITION))
    throw new Error(`No IR for ${MANIFEST_EDITION}`);
  // Stream rows to disk per edition and keep only a compact index of the
  // matched values — the full row set (~1.7M) never sits in memory.
  const writer = new VintageWriter();
  const index: VintageIndex = new Map();
  const res = matchEditions(
    manifest,
    editions,
    (e) => {
      // Each edition's IR is ~200 MB of objects once parsed; collect the
      // previous one before parsing the next so peak memory stays low.
      Bun.gc(true);
      return readIR(e);
    },
    MANIFEST_EDITION,
    (rows) => {
      writer.write(rows);
      indexVintages(rows, index);
    },
  );
  writer.close();
  writeLatest(index);
  for (const s of manifest)
    for (const t of s.tables)
      for (const m of t.measurements)
        for (const x of m.series) {
          x.editions = res.editions.get(x.name)?.size ?? 0;
          x.interpolate = needsInterpolation([
            ...latestObserved(index.get(x.name)).keys(),
          ]);
        }
  writeManifest(manifest);

  const report = join(databookDir(), "match-report.csv");
  writeFileSync(
    report,
    [
      "edition,table_num,lineage,score,groups,matched_groups,cells,matched_cells,title",
      ...res.tables.map((t) =>
        [
          t.edition,
          t.tableNum,
          t.lineage ?? "",
          t.score,
          t.groups,
          t.matchedGroups,
          t.cells,
          t.matchedCells,
          `"${t.title.replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n") + "\n",
  );

  const byEdition = new Map<number, { cells: number; matched: number }>();
  for (const t of res.tables) {
    const e = byEdition.get(t.edition) ?? { cells: 0, matched: 0 };
    e.cells += t.cells;
    e.matched += t.matchedCells;
    byEdition.set(t.edition, e);
  }
  for (const [e, c] of [...byEdition].sort((a, b) => a[0] - b[0])) {
    console.log(
      `${e}: ${c.matched}/${c.cells} cells matched (${((100 * c.matched) / Math.max(1, c.cells)).toFixed(1)}%)`,
    );
  }
  console.log(
    JSON.stringify({
      vintages: vintagesPath(),
      report,
      ...planManifest(manifest),
    }),
  );
}

async function run(args: Args): Promise<void> {
  switch (args.command) {
    case "fetch": {
      if (!args.editions.length) usage();
      for (const e of args.editions) {
        const res = await fetchEdition(e);
        console.log(`${e}: ${res.files.length} files, changed=${res.changed}`);
      }
      return;
    }

    case "extract": {
      const editions = args.all
        ? Array.from(
            { length: MANIFEST_EDITION - 2002 + 1 },
            (_, i) => 2002 + i,
          )
        : args.editions;
      if (!editions.length) usage();
      for (const e of editions) {
        const ir = extractEdition(e);
        const p = writeIR(ir);
        console.log(JSON.stringify({ ...coverage(ir), path: p }));
      }
      return;
    }

    case "propose": {
      const ir = readIR(MANIFEST_EDITION);
      const previous = readManifest();
      const sections = propose(ir, { narratives: ir.narratives, previous });
      // Carry match results forward for series that keep their name.
      const prevSeries = new Map(
        previous.flatMap((s) =>
          s.tables.flatMap((t) =>
            t.measurements.flatMap((m) =>
              m.series.map((x) => [x.name, x] as const),
            ),
          ),
        ),
      );
      for (const s of sections)
        for (const t of s.tables)
          for (const m of t.measurements)
            for (const x of m.series) {
              const p = prevSeries.get(x.name);
              if (p) {
                x.editions = p.editions;
                x.interpolate = p.interpolate;
              }
            }
      writeManifest(sections);
      console.log(JSON.stringify(planManifest(sections)));
      return;
    }

    case "match":
      runMatch();
      return;

    case "annual": {
      // One new (or re-issued) edition: fetch → extract → match all →
      // apply (snapshot series may cross the 5-edition threshold) → load
      // only that edition's vintage.
      if (args.editions.length !== 1) usage();
      const edition = args.editions[0];
      const fetched = await fetchEdition(edition);
      console.log(`${edition}: fetched, changed=${fetched.changed}`);
      const ir = extractEdition(edition);
      writeIR(ir);
      console.log(JSON.stringify(coverage(ir)));
      runMatch();
      if (!args.execute) {
        console.log("Dry run — pass --execute to apply and load.");
        return;
      }
      console.log(JSON.stringify(await applyManifest(readManifest())));
      const stats = await loadHistory({
        editions: [edition],
        publicSync: args.publicSync,
        concurrency: args.concurrency,
      });
      console.log(
        JSON.stringify({ ...stats, errors: stats.errors.slice(0, 20) }),
      );
      return;
    }

    case "apply": {
      const manifest = readManifest();
      console.log(JSON.stringify(planManifest(manifest)));
      if (!args.execute) {
        console.log("Dry run — pass --execute to write to the database.");
        return;
      }
      console.log(JSON.stringify(await applyManifest(manifest)));
      if (args.prune)
        console.log(JSON.stringify({ pruned: await pruneManifest(manifest) }));
      return;
    }

    case "publish": {
      // Force a full public_data_points sync (recovery, or after a load
      // run with --no-public-sync).
      await publishDatabook();
      console.log("DATABOOK public data points synced (full pass).");
      return;
    }

    case "history": {
      const stats = await loadHistory({
        editions: args.editions.length ? args.editions : undefined,
        series: args.series.length ? args.series : undefined,
        dryRun: !args.execute,
        publicSync: args.publicSync,
        concurrency: args.concurrency,
      });
      console.log(
        JSON.stringify({ ...stats, errors: stats.errors.slice(0, 20) }),
      );
      if (!args.execute)
        console.log("Dry run — pass --execute to write data points.");
      return;
    }

    default:
      usage();
  }
}

const args = parseArgs(process.argv.slice(2));
// Top-level await: Bun exits once nothing is pending, mid-query otherwise.
try {
  await run(args);
  process.exit(0);
} catch (err) {
  log.error(
    { err: err instanceof Error ? err.message : String(err) },
    "databook command failed",
  );
  console.error(err);
  process.exit(1);
}
