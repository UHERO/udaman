// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

import { createLogger } from "@/core/observability/logger";

import { errorMessage, TABLE_LOADERS } from "./processors/qpub-load";
import { processNightly } from "./processors/qpub-nightly";
import {
  rebuildAll,
  rebuildTable,
  runParseAndExtract,
  runLoad,
  runSync,
} from "./processors/qpub-rebuild";

const log = createLogger("qpub-cli");

function usage(): never {
  const tables = Object.keys(TABLE_LOADERS).join(", ");
  console.log(`
Usage: bun run src/core/workers/qpub-cli.ts <command> [options]

Commands:
  nightly                       Parse+load freshly scraped records
  rebuild-table <table>         Rebuild a single table (all phases)
  rebuild-all                   Rebuild all tables (all phases)

  parse-extract                 Phase 1+2: Parse HTML→JSON, extract JSON→JSONL table files
  load                          Phase 3: Load JSONL files into local DB via mariadb CLI
  load-table <table>            Phase 3: Load a single table into local DB
  sync                          Sync: Dump local DB to remote + update scrape_status
  sync-table <table>            Sync: Dump specific table to remote

Options:
  --island <code>               Filter by island (1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai)
  --period <period>             Filter by NAS period dir (e.g., 2026-1)
  --force-parse                 Force re-parse even when JSON is newer than HTML

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

  const tableCommands = ["rebuild-table", "load-table", "sync-table"];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--island" && args[i + 1]) {
      island = args[++i];
    } else if (args[i] === "--period" && args[i + 1]) {
      period = args[++i];
    } else if (args[i] === "--force-parse") {
      forceParse = true;
    } else if (!table && tableCommands.includes(command)) {
      table = args[i];
    }
  }

  return { command, table, island, period, forceParse };
}

async function run() {
  const { command, table, island, period, forceParse } = parseArgs();

  switch (command) {
    case "nightly": {
      const result = await processNightly();
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

process.on("uncaughtException", (err) => {
  log.error({ error: errorMessage(err) }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  log.error({ error: errorMessage(err) }, "Unhandled rejection");
  process.exit(1);
});

run().catch((err) => {
  log.error({ error: errorMessage(err) }, "qpub-cli crashed");
  process.exit(1);
});
