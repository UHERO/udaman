import { list, load, refreshFreq } from "@/core/crawlers/renthub/load";
import type { RenthubOptions } from "@/core/crawlers/renthub/load";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("renthub-cli");

function usage(): never {
  console.log(`
Usage: bun run renthub <command> [options]

Load the Hawaii file (HI.csv.gz) of every RentHub delivery on the NAS into
renthub_listings, geocoding each listing to a parcel TMK (CPR always 0000)
from its lat/lon and its street address (matched against the qPublic
addresses of nearby parcels). Apply src/lib/hhdb/migrations/2026-10-05-create-renthub-listings.sql
first.

Commands:
  list          Show each delivery directory and whether it is loaded
  load          Load every delivery not yet recorded in renthub_loads (or
                whose file size changed). Rerun after a new delivery lands;
                rerun with --force after the parcel layer or properties change.
  freq          Rebuild freq_renthub_listings (Summary / Exploration counts)
                from the loaded rows, without reloading. load runs this itself.

Options:
  --dry-run        Parse, validate and geocode every HI file, write nothing
  --force          Reload deliveries that are already loaded
  --batch <name>   Only this delivery, e.g. 2026-01-07_2026-01-21 (repeatable)
  --local          Write to the local rebuild DB instead of the remote housing DB
  --root <dir>     Delivery root (default $RENTHUB_RAW_PATH, else
                   /Volumes/UHEROroot/datashare/renthub/rawdata)
  --parcels <file> TMK polygon GeoJSON (default $RENTHUB_PARCELS_PATH, else
                   /Volumes/UHEROroot/work/research/housing/shapefiles/Statewide_TMKs.geojson)
  --max-nearest <m>  Let a point inside no parcel take the nearest parcel
                   within this many metres, flagged tmk_match = nearest.
                   Default 0 (within only): spot checks found those nearest
                   parcels right only ~19% of the time.
  --address-radius <m>  Look this far from the point for a parcel with the
                   listing's address (default 300, widened for coarse
                   coordinates; 0 = point only, no properties read)
`);
  process.exit(1);
}

function parseArgs(argv: string[]): { command: string; opts: RenthubOptions } {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") usage();
  const opts: RenthubOptions = {};
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
      case "--force":
        opts.force = true;
        break;
      case "--local":
        opts.local = true;
        break;
      case "--batch":
        (opts.batches ??= []).push(next());
        break;
      case "--root":
        opts.root = next();
        break;
      case "--parcels":
        opts.parcels = next();
        break;
      case "--address-radius": {
        const m = Number(next());
        if (!Number.isFinite(m) || m < 0) usage();
        opts.addressRadiusM = m;
        break;
      }
      case "--max-nearest": {
        const m = Number(next());
        if (!Number.isFinite(m) || m < 0) usage();
        opts.maxNearestM = m;
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
  let stopping = false;
  opts.shouldStop = () => stopping;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      if (stopping) process.exit(130);
      stopping = true;
      log.warn({ sig }, "stopping after the current batch (again to force)");
    });
  }
  if (command === "list") {
    console.table(await list(opts));
  } else if (command === "load") {
    console.log(JSON.stringify(await load(opts), null, 2));
  } else if (command === "freq") {
    console.log(JSON.stringify(await refreshFreq(opts), null, 2));
  } else {
    usage();
  }
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
  reportFatal("renthub-cli crashed", err);
}
