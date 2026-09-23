import { list, load, profiles, run } from "@/core/crawlers/dcca/pipeline";
import type { DccaRunOptions } from "@/core/crawlers/dcca/pipeline";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("dcca-cli");

function usage(): never {
  console.log(`
Usage: bun run dcca <command> [options]

Scrape the DCCA Real Estate Branch condo register
(https://web3.dcca.hawaii.gov/reb/public/) into condominium_projects.

Commands:
  list          Fetch the index page (once per day; cached) and write the
                registration list: runs/<date>-list.json
  profiles      Fetch every profile page not yet cached. ~9,300 pages at
                ~1.1 s each on the first run (≈3 h); resumable — rerun after
                an interruption and it continues where it left off.
  load          Parse the cached profiles, match each to a condominium_projects
                row (by TMK, else by name), write the register fields, and
                write runs/<date>-report.csv (one line per profile). No network.
                Rerun after every qpub sync: the sync recreates the table
                without these fields.
  run           list, profiles, load — in that order.

Options:
  --dry-run       Parse and match, write nothing to the database (report still written)
  --local         Write to the local rebuild DB instead of the remote housing DB
  --insert-new    For a profile whose TMK is a real parcel with no condo row,
                  create the row (name + unit count from the register).
                  Off by default — the register's TMK is sometimes wrong.
  --refetch       Ignore cached HTML and fetch again
  --max <n>       Stop after n profile fetches (profiles) / n profiles (load)
  --date <ymd>    Run date for cache paths (default: today, HST)

HTML is cached under <NAS>/work/scrapes/dcca; set DCCA_NAS_PATH to use a
local dir. Without the NAS mounted a temp dir is used.
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; opts: DccaRunOptions } {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const opts: DccaRunOptions = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => {
      const v = rest[++i];
      if (v === undefined) usage();
      return v;
    };
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--local":
        opts.local = true;
        break;
      case "--insert-new":
        opts.insertNew = true;
        break;
      case "--refetch":
        opts.refetch = true;
        break;
      case "--max": {
        const n = Number(next());
        if (!Number.isInteger(n) || n < 1) usage();
        opts.max = n;
        break;
      }
      case "--date":
        opts.date = next();
        break;
      default:
        console.error(`Unknown option: ${a}`);
        usage();
    }
  }
  return { command, opts };
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  let stopping = false;
  opts.shouldStop = () => stopping;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      if (stopping) process.exit(130);
      stopping = true;
      log.warn({ sig }, "stopping after the current request (again to force)");
    });
  }
  const commands = { list, profiles, load, run };
  const fn = commands[command as keyof typeof commands];
  if (!fn) usage();
  const summary = await fn(opts);
  console.log(JSON.stringify(summary, null, 2));
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
  reportFatal("dcca-cli crashed", err);
}
