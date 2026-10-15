import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyManifest,
  planManifest,
  pruneManifest,
} from "@/core/databook/apply";
import { loadHistory, publishDatabook } from "@/core/databook/history";
import { storedDatabook } from "@/core/databook/source";
import {
  databookDir,
  readManifest,
  writeManifest,
} from "@/core/databook/store";
import { needsInterpolation } from "@/core/ingest/sources/databook/match";
import {
  latestValues,
  type MatchedDatabook,
} from "@/core/ingest/sources/databook/parse";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("databook-cli");

function usage(): never {
  console.log(`
Usage: bun run databook <command> [options]

DBEDT Data Book → DATABOOK universe (docs/2026-10-10-databook-universe-plan.md).
The workbooks are fetched and parsed by the ingest source "databook"
(src/core/ingest/sources/databook): bun run ingest fetch|extract databook.
Loaders read its extract: Series.load_from_extract("databook", { table, name, geo }).

  sync     [--fresh]          Match the stored editions to the base edition and refresh
                              the manifest (data-dir/databook/manifest/), keeping existing
                              names (--fresh: reassign every name; only before production);
                              records editions/observations/interpolate per series and
                              writes data-dir/databook/match-report.csv
  apply    [--execute] [--prune]
                              Upsert the manifest into the database (dry run by default);
                              --prune deletes DATABOOK series/measurements not in it
  history  [--execute] [--no-public-sync] [--concurrency N] [--edition Y ...] [--series NAME ...]
                              Load each edition as a vintage, oldest first (dry run by default).
                              Resumable: re-running skips what is already loaded.
  publish                     Full public_data_points sync for DATABOOK (history runs it)
  annual   --edition Y [--execute] [--no-public-sync]
                              After DBEDT publishes (or re-issues) edition Y and the ingest
                              fetch/extract have run: sync, apply, load edition Y's vintage

Setting up from scratch (needs DATA_DIR and the ingest migrations; peaks at ~1.8 GB):

  bun run ingest fetch databook         # every edition's workbooks
  bun run ingest extract databook       # the extract the loaders read
  bun run databook sync                 # → manifest/ (names; first run creates them)
  bun run databook apply --execute      # universe, geographies, categories, series, loaders
  bun run databook history --execute    # every edition as a vintage, then full public sync

  Then clear the REST API cache:
  redis-cli --scan --pattern '*u=databook*' | xargs -r redis-cli del

Each later year, when DBEDT publishes edition Y (the weekly fetch picks it up):

  bun run databook annual --edition Y --execute
`);
  process.exit(1);
}

interface Args {
  command: string;
  editions: number[];
  execute: boolean;
  publicSync: boolean;
  prune: boolean;
  fresh: boolean;
  concurrency?: number;
  series: string[];
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const args: Args = {
    command,
    editions: [],
    execute: false,
    publicSync: true,
    prune: false,
    fresh: false,
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
      case "--execute":
        args.execute = true;
        break;
      case "--no-public-sync":
        args.publicSync = false;
        break;
      case "--prune":
        args.prune = true;
        break;
      case "--fresh":
        args.fresh = true;
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

/** Match the stored editions; refresh the manifest and its counts; write the report. */
async function runSync(fresh: boolean): Promise<MatchedDatabook> {
  const previous = fresh ? [] : readManifest();
  const m = await storedDatabook({ previous, log: (msg) => console.log(msg) });
  for (const sec of m.manifest)
    for (const t of sec.tables)
      for (const ms of t.measurements)
        for (const x of ms.series) {
          const s = m.series.get(x.name);
          const dates = s ? [...latestValues(s.byEdition).keys()] : [];
          x.editions = s?.byEdition.size ?? 0;
          x.observations = dates.length;
          x.interpolate = needsInterpolation(dates);
        }
  writeManifest(m.manifest);

  const report = join(databookDir(), "match-report.csv");
  writeFileSync(
    report,
    [
      "edition,table_num,lineage,score,groups,matched_groups,cells,matched_cells,title",
      ...m.tables.map((t) =>
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
  for (const t of m.tables) {
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
  console.log(JSON.stringify({ report, ...planManifest(m.manifest) }));
  return m;
}

async function run(args: Args): Promise<void> {
  switch (args.command) {
    case "sync":
      await runSync(args.fresh);
      return;

    case "annual": {
      // A new (or re-issued) edition, already fetched and extracted: sync
      // (snapshot series may cross the 5-edition threshold), apply, then
      // load only that edition's vintage.
      if (args.editions.length !== 1) usage();
      const edition = args.editions[0];
      const matched = await runSync(false);
      if (!matched.editions.includes(edition))
        throw new Error(
          `edition ${edition} is not stored (bun run ingest fetch databook)`,
        );
      if (!args.execute) {
        console.log("Dry run — pass --execute to apply and load.");
        return;
      }
      console.log(JSON.stringify(await applyManifest(readManifest())));
      const stats = await loadHistory(
        {
          editions: [edition],
          publicSync: args.publicSync,
          concurrency: args.concurrency,
        },
        matched,
      );
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
