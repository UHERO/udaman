import { createLogger } from "@/core/observability/logger";

import { errorMessage, TABLE_LOADERS } from "./processors/qpub-load";
import { processNightly } from "./processors/qpub-nightly";
import { backfillCondoUnits } from "./processors/qpub-enqueue";
import { runDumpCsv } from "./processors/qpub-dump-csv";
import { runCrosswalk } from "./processors/qpub-crosswalk";
import { runParcelList } from "./processors/qpub-parcel-list";
import { runParseAudit } from "./processors/qpub-parse-audit";
import { runRepair } from "./processors/qpub-repair";
import {
  rebuildAll,
  rebuildTable,
  runLoad,
  runParseAndExtract,
  runSync,
} from "./processors/qpub-rebuild";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("qpub-cli");

function usage(): never {
  const tables = Object.keys(TABLE_LOADERS).join(", ");
  console.log(`
Usage: bun run src/core/workers/qpub-cli.ts <command> [options]

Commands:
  nightly                       Parse+load freshly scraped records
  rebuild-table <table>         Rebuild a single table (all phases)
  rebuild-all                   Rebuild all tables (all phases)

  repair                        Sync scrape_status to what's on the NAS.
                                Dry run unless --execute. Defaults to the
                                newest period directory on disk.

  parcel-list                   Flag TMKs by whether the State's statewide
                                parcel list still contains them. Deletes
                                nothing. Dry run unless --execute.

  crosswalk                     Load the parcel/ZCTA/census-tract crosswalk
                                into parcel_crosswalk and stamp centroid,
                                zcta20 and tract FIPS onto properties.
                                Dry run unless --execute.

  condo-units                   Queue condo units listed on masters already
                                scraped to the NAS. Dry run unless --execute.

  parse-audit                   Report data the pipeline is dropping: empty
                                tables, dead columns, per-county gaps, numeric
                                strings and identity collisions. Read-only;
                                run between parse-extract and load.

  parse-extract                 Phase 1+2: Parse HTML→JSON, extract JSON→JSONL table files
  load                          Phase 3: Load JSONL files into local DB via mariadb CLI
  load-table <table>            Phase 3: Load a single table into local DB
  sync                          Sync: Dump local DB to remote + update scrape_status
  sync-table <table>            Sync: Dump specific table to remote

  dump-csv [table]              Export remote DB tables to CSV files on the NAS
                                datashare. All pipeline tables by default, or a
                                single named table (e.g. tg_transactions).

Options:
  --island <code>               Filter by island (1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai)
  --period <period>             Filter by NAS period dir (e.g., 2026-1)
  --force-parse                 Force re-parse even when JSON is newer than HTML

Repair options:
  --execute                     Apply changes (repair is a dry run without it)
  --keep-bad-files              Don't delete captcha/shell/blocked files
  --reset-missing               Also clear rows with no file in the period

Parse-audit options:
  --staging <dir>               Staging dir (default: the extract's own)
  --sample <n>                  Pages to sample for section coverage (0 skips)

Dump-csv options:
  --out <dir>                   Output directory (default:
                                /Volumes/UHEROroot/datashare/qpub/<YYYY-MM-DD>)

Parcel-list options:
  --execute                     Apply changes (dry run without it)
  --file <csv>                  Statewide parcel CSV (default: newest on the NAS)
  --properties-only             Skip the CSV; re-mirror scrape_status flags onto
                                properties (run after a rebuild recreates it)
  --add-new                     Queue parcels the State lists that we don't have

Crosswalk options:
  --execute                     Apply changes (dry run without it)
  --file <csv>                  Crosswalk CSV (default: the NAS copy beside
                                the statewide parcel list)
  --properties-only             Skip the CSV; re-mirror parcel_crosswalk onto
                                properties (run after a rebuild recreates it)

Valid tables:
  ${tables}
`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const command = args[0];
  let table: string | undefined;
  let island: string | undefined;
  let period: string | undefined;
  let forceParse = false;
  let execute = false;
  let keepBadFiles = false;
  let resetMissing = false;
  let file: string | undefined;
  let propertiesOnly = false;
  let addNew = false;
  let staging: string | undefined;
  let sample: number | undefined;
  let out: string | undefined;

  const tableCommands = ["rebuild-table", "load-table", "sync-table", "dump-csv"];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--island" && args[i + 1]) {
      island = args[++i];
    } else if (args[i] === "--period" && args[i + 1]) {
      period = args[++i];
    } else if (args[i] === "--force-parse") {
      forceParse = true;
    } else if (args[i] === "--execute") {
      execute = true;
    } else if (args[i] === "--keep-bad-files") {
      keepBadFiles = true;
    } else if (args[i] === "--reset-missing") {
      resetMissing = true;
    } else if (args[i] === "--file" && args[i + 1]) {
      file = args[++i];
    } else if (args[i] === "--properties-only") {
      propertiesOnly = true;
    } else if (args[i] === "--add-new") {
      addNew = true;
    } else if (args[i] === "--staging" && args[i + 1]) {
      staging = args[++i];
    } else if (args[i] === "--sample" && args[i + 1]) {
      sample = Number(args[++i]);
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i];
    } else if (!table && tableCommands.includes(command)) {
      table = args[i];
    }
  }

  return {
    command,
    table,
    island,
    period,
    forceParse,
    execute,
    keepBadFiles,
    resetMissing,
    file,
    propertiesOnly,
    addNew,
    staging,
    sample,
    out,
  };
}

async function run() {
  const {
    command,
    table,
    island,
    period,
    forceParse,
    execute,
    keepBadFiles,
    resetMissing,
    file,
    propertiesOnly,
    addNew,
    staging,
    sample,
    out,
  } = parseArgs();

  switch (command) {
    case "nightly": {
      const result = await processNightly();
      log.info(result);
      break;
    }

    case "parcel-list": {
      const result = await runParcelList({
        file,
        execute,
        propertiesOnly,
        addNew,
      });
      log.info(result);
      break;
    }

    case "crosswalk": {
      const result = await runCrosswalk({ file, execute, propertiesOnly });
      log.info(result);
      break;
    }

    case "parse-audit": {
      const result = await runParseAudit({
        stagingDir: staging,
        period,
        island,
        sample,
      });
      log.info(result);
      break;
    }

    case "condo-units": {
      const result = await backfillCondoUnits({ period, island, execute });
      log.info(result);
      break;
    }

    case "repair": {
      const result = await runRepair({
        island,
        period,
        execute,
        keepBadFiles,
        resetMissing,
      });
      log.info(result);
      break;
    }

    case "rebuild-table": {
      if (!table) {
        console.error("Error: rebuild-table requires a table name");
        usage();
      }
      const result = await rebuildTable(table, { island, period, forceParse });
      log.info(result);
      break;
    }

    case "rebuild-all": {
      const result = await rebuildAll({ island, period, forceParse });
      log.info(result);
      break;
    }

    case "parse-extract": {
      const result = await runParseAndExtract({ island, period, forceParse });
      log.info(result);
      break;
    }

    case "load": {
      const result = await runLoad();
      log.info(result);
      break;
    }

    case "load-table": {
      if (!table) {
        console.error("Error: load-table requires a table name");
        usage();
      }
      const result = await runLoad({ table });
      log.info(result);
      break;
    }

    case "sync": {
      const result = await runSync({ island, period });
      log.info(result);
      break;
    }

    case "dump-csv": {
      const result = await runDumpCsv({ table, out });
      log.info(
        {
          outDir: result.outDir,
          tables: result.tables.length,
          totalRows: result.totalRows,
        },
        "dump-csv complete",
      );
      break;
    }

    case "sync-table": {
      if (!table) {
        console.error("Error: sync-table requires a table name");
        usage();
      }
      const result = await runSync({ table, island, period });
      log.info(result);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }

  process.exit(0);
}

/**
 * Report a fatal error on stderr *before* anything else touches it.
 *
 * The logger is the thing most likely to be broken when a process is dying, and
 * routing a crash through it is how `parcel-list --execute` came to report
 * "sonic boom is not ready yet" while the real exception vanished. console.error
 * writes the stack synchronously and depends on nothing.
 */
function reportFatal(label: string, err: unknown): never {
  console.error(`\n${label}: ${errorMessage(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  log.error({ error: errorMessage(err) }, label);
  process.exit(1);
}

process.on("uncaughtException", (err) => reportFatal("Uncaught exception", err));
process.on("unhandledRejection", (err) => reportFatal("Unhandled rejection", err));

// Awaited at top level on purpose: a fire-and-forget `run().catch(...)` leaves
// nothing pending in module scope, and Bun has been seen to exit 0 mid-command
// while a database query was still in flight (the crosswalk upsert never ran,
// no error, no summary). A top-level await keeps the process alive until the
// command has actually finished.
try {
  await run();
} catch (err) {
  reportFatal("qpub-cli crashed", err);
}
