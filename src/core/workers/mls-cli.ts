import { backfill, daily, reparse } from "@/core/crawlers/mls/pipeline";
import type { MlsRunOptions } from "@/core/crawlers/mls/pipeline";
import { MLS_SITES } from "@/core/crawlers/mls/registry";
import type { IslandKey } from "@/core/crawlers/mls/types";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("mls-cli");

function usage(): never {
  console.log(`
Usage: bun run mls <command> [options]

Commands:
  backfill      One-time look back through every listing the site will serve
                (any status, to the site's page cap). Hours of polite fetching.
                Resumable — rerun after an interruption.
  daily         Open listings only: insert new, refresh changed, and re-check
                listings that dropped off the open list (sold / off market).
                This is what the scheduled worker job runs.
  reparse       Re-parse the latest cached HTML for every listing and upsert.
                No network.

Options:
  --site <name>        ${Object.keys(MLS_SITES).join(" | ")} (default: hicentral)
  --island <a,b>       Limit to these islands
  --max-pages <n>      Stop each list walk after n pages (smoke test;
                       disables the departed check)
  --max-details <n>    Stop after n detail pages
  --dry-run            Fetch, cache and parse, but write nothing to the database
  --refetch            Ignore same-day cached HTML

HTML is cached under <NAS>/work/scrapes/mls; set MLS_NAS_PATH to use a local dir.
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; opts: MlsRunOptions } {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const opts: MlsRunOptions = { site: "hicentral" };

  const intArg = (flag: string, raw: string | undefined): number => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`${flag} needs a positive integer`);
      usage();
    }
    return n;
  };

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--site") opts.site = rest[++i] ?? usage();
    else if (arg === "--island") {
      opts.islands = (rest[++i] ?? usage()).split(",") as IslandKey[];
    } else if (arg === "--max-pages") opts.maxPages = intArg(arg, rest[++i]);
    else if (arg === "--max-details") opts.maxDetails = intArg(arg, rest[++i]);
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--refetch") opts.refetch = true;
    else {
      console.error(`Unknown option: ${arg}`);
      usage();
    }
  }
  return { command, opts };
}

async function run(): Promise<void> {
  const { command, opts } = parseArgs(process.argv.slice(2));
  const commands = { backfill, daily, reparse };
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

// Awaited at top level on purpose — see the note at the end of qpub-cli.ts:
// Bun can exit 0 with a database write still in flight if nothing in module
// scope is awaited.
try {
  await run();
  process.exit(0);
} catch (err) {
  reportFatal("mls-cli crashed", err);
}
