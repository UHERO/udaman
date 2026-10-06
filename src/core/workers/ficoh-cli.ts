import { load, refreshFreq } from "@/core/crawlers/ficoh/load";
import type { FicohOptions } from "@/core/crawlers/ficoh/load";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("ficoh-cli");

function usage(): never {
  console.log(`
Usage: bun run ficoh load|freq [options]

  freq   Rebuild the insurance freq_ tables (Summary / Exploration counts)
         from the loaded rows, without reloading. load runs this itself.

Load the FICOH homeowners policy / claim workbook into insurance_policies and
insurance_claims, REPLACING both tables in one transaction. Each row is
geocoded to a parcel TMK by address, and each claim is linked to the policy
row in force on its date of loss. Apply
src/lib/hhdb/migrations/2026-10-05-create-insurance-tables.sql first, and
2026-10-05-freq-insurance.sql after the load.

Data use: FICOH data is for approved researchers only and may be reported
only in aggregate (FICOH Data Guidelines.docx).

Options:
  --dry-run        Parse, geocode and link, write nothing
  --local          Write to the local rebuild DB instead of the remote housing DB
  --file <xlsx>    Workbook (default $FICOH_FILE, else
                   /Volumes/UHEROroot/datashare/ficoh/Data Set for Homeowners policy and Loss.xlsx)
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; opts: FicohOptions } {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const opts: FicohOptions = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--local":
        opts.local = true;
        break;
      case "--file": {
        const v = rest[++i];
        if (v === undefined) usage();
        opts.file = v;
        break;
      }
      default:
        console.error(`Unknown option: ${a}`);
        usage();
    }
  }
  return { command, opts };
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (command === "load")
    console.log(JSON.stringify(await load(opts), null, 2));
  else if (command === "freq")
    console.log(JSON.stringify(await refreshFreq(opts), null, 2));
  else usage();
}

function reportFatal(label: string, err: unknown): never {
  console.error(
    `\n${label}: ${err instanceof Error ? err.message : String(err)}`,
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
  log.error({ err }, label);
  process.exit(1);
}

process.on("uncaughtException", (err) =>
  reportFatal("Uncaught exception", err),
);
process.on("unhandledRejection", (err) =>
  reportFatal("Unhandled rejection", err),
);

// Awaited at top level on purpose (see qpub-cli.ts): Bun can exit 0 with a
// database write still in flight if nothing in module scope is awaited.
try {
  await main();
  process.exit(0);
} catch (err) {
  reportFatal("ficoh-cli crashed", err);
}
