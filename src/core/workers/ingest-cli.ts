import DataDownloaderCollection from "@catalog/collections/data-downloader-collection";
import DataExtractorCollection from "@catalog/collections/data-extractor-collection";
import ExtractionRunCollection from "@catalog/collections/extraction-run-collection";
import FetchRunCollection from "@catalog/collections/fetch-run-collection";
import RawArtifactCollection from "@catalog/collections/raw-artifact-collection";
import { formatHst } from "@catalog/utils/time";

import { readExtractIndex } from "@/core/ingest/extract-file";
import { runGoogleAuth } from "@/core/ingest/google-sheets";
import { fileRawStore } from "@/core/ingest/raw-store";
import { sourceKeys } from "@/core/ingest/registry";
import { runExtract, runFetch } from "@/core/ingest/run";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("ingest-cli");

function usage(): never {
  console.log(`
Usage: bun run ingest <command> [options]

  list                       Downloaders and extractors with their last run
  fetch <downloader>         Fetch in this process (not the queue), then
                             extract the extractors that read it
      --force                Refetch even when a shortcut says nothing changed
      --full                 Also refetch keys marked final
      --no-extract           Fetch only
  extract <extractor>        Parse the stored inputs and validate
      --force                Parse even when the inputs are unchanged
  runs <handle> [--limit n]  Recent fetch / extraction runs
  run <extraction run id>    One extraction run with its validation results
  accept <run id>            Publish a failed extraction run whose failures
                             are all soft (disappeared series, jumps, gaps)
  artifacts <downloader>     Newest vintage of every key
      --key <key>            Every vintage of one key
  series <extractor>         Series in the latest ok extract
      --where dim=value      Filter (repeatable)
  google-auth                Mint GOOGLE_SHEETS_REFRESH_TOKEN for dotax_sheet
      --redirect <uri>       Redirect URI registered on the OAuth client
                             (default http://localhost:3008/api/auth/callback/google)

Source modules: ${sourceKeys().join(", ")}
`);
  process.exit(1);
}

const pad = (s: unknown, n: number) => String(s ?? "").padEnd(n);
const when = (d: Date | null) => (d ? formatHst(d, "yyyy-MM-dd HH:mm") : "-");

async function list() {
  const downloaders = await DataDownloaderCollection.list();
  const lastFetch = await FetchRunCollection.latestByDownloader();
  const counts = await RawArtifactCollection.countsByDownloader();
  console.log("DOWNLOADERS");
  for (const d of downloaders) {
    const r = lastFetch.get(d.id);
    const c = counts.get(d.id);
    console.log(
      `  ${pad(d.handle, 18)} ${pad(d.strategy, 18)} ${pad(d.enabled ? (d.schedule ?? "manual") : "disabled", 16)} ` +
        `${pad(c ? `${c.keys} keys / ${c.vintages} vintages` : "nothing stored", 28)} ` +
        `${r ? `${r.status} ${when(r.startedAt)}${r.error ? ` — ${r.error.slice(0, 80)}` : ""}` : "never run"}`,
    );
  }
  const extractors = await DataExtractorCollection.list();
  const lastExtract = await ExtractionRunCollection.latestByExtractor();
  console.log("\nEXTRACTORS");
  for (const e of extractors) {
    const inputs = await DataExtractorCollection.getInputs(e.id);
    const r = lastExtract.get(e.id);
    const ok = await ExtractionRunCollection.latestOk(e.id);
    console.log(
      `  ${pad(e.handle, 14)} ${pad(e.sourceKey, 12)} ← ${pad(inputs.map((i) => i.downloaderHandle).join(", "), 30)} ` +
        `${r ? `last ${r.status} #${r.id} ${when(r.startedAt)}` : "never run"}` +
        `${ok ? `; serving #${ok.id} (${ok.seriesCount} series, ${ok.rowCount} rows)` : "; no ok output"}`,
    );
  }
}

async function runs(handle: string, limit: number) {
  const dl = (await DataDownloaderCollection.list()).find(
    (d) => d.handle === handle,
  );
  if (dl) {
    for (const r of await FetchRunCollection.listForDownloader(dl.id, limit)) {
      console.log(
        `fetch #${r.id} ${pad(r.status, 9)} ${when(r.startedAt)} ${pad(r.triggeredBy, 10)} ` +
          `${JSON.stringify({ artifacts: r.stats.artifacts, newVintages: r.stats.newVintages })}` +
          `${r.error ? ` — ${r.error}` : ""}`,
      );
    }
  }
  const ex = (await DataExtractorCollection.list()).find(
    (e) => e.handle === handle,
  );
  if (ex) {
    for (const r of await ExtractionRunCollection.listForExtractor(
      ex.id,
      limit,
    )) {
      console.log(
        `extract #${r.id} ${pad(r.status, 9)} ${when(r.startedAt)} ${pad(r.triggeredBy, 10)} ` +
          `${r.seriesCount ?? "-"} series ${r.rowCount ?? "-"} rows${r.acceptedAt ? " (accepted)" : ""}` +
          `${r.error ? ` — ${r.error.slice(0, 200)}` : ""}`,
      );
    }
  }
  if (!dl && !ex) {
    console.error(`No downloader or extractor "${handle}"`);
    process.exitCode = 1;
  }
}

async function showRun(id: number) {
  const r = await ExtractionRunCollection.getById(id);
  console.log(
    `extract #${r.id} ${r.status}${r.acceptedAt ? " (accepted)" : ""}, ${r.seriesCount ?? "-"} series, ${r.rowCount ?? "-"} rows, output ${r.outputPath ?? "-"}`,
  );
  if (r.error) console.log(`error: ${r.error}`);
  console.log(`stats: ${JSON.stringify(r.stats)}`);
  for (const v of r.validationResults) {
    console.log(
      `  ${v.passed ? "ok  " : "FAIL"} [${v.severity}] ${v.check}: ${v.message}`,
    );
    if (!v.passed)
      for (const d of v.details ?? [])
        console.log(
          `         ${typeof d === "string" ? d : JSON.stringify(d)}`,
        );
  }
}

async function artifacts(handle: string, key: string | undefined) {
  const dl = await DataDownloaderCollection.getByHandle(handle);
  const rows = key
    ? await RawArtifactCollection.vintagesOfKey(dl.id, key)
    : await RawArtifactCollection.latestPerKey([dl.id]);
  for (const a of rows) {
    console.log(
      `#${a.id} ${pad(a.artifactKey, 44)} ${a.contentHash.slice(0, 12)} ${pad(a.size, 9)} ` +
        `first ${when(a.fetchedAt)} seen ${when(a.lastSeenAt)}${a.final ? " final" : ""}`,
    );
  }
  console.log(`${rows.length} artifact(s)`);
}

async function series(handle: string, where: string[]) {
  const ex = await DataExtractorCollection.getByHandle(handle);
  const ok = await ExtractionRunCollection.latestOk(ex.id);
  if (!ok?.outputPath) {
    console.error(`${handle} has no ok extraction run yet`);
    process.exitCode = 1;
    return;
  }
  const index = readExtractIndex(fileRawStore().absolute(ok.outputPath));
  if (!index) throw new Error(`output file missing: ${ok.outputPath}`);
  const filters = where.map((w) => {
    const i = w.indexOf("=");
    if (i < 1) throw new Error(`--where expects dim=value, got "${w}"`);
    return [w.slice(0, i), w.slice(i + 1)] as const;
  });
  let n = 0;
  for (const s of index.series.values()) {
    if (!filters.every(([d, v]) => s.dims[d] === v)) continue;
    const dates = [...s.data.keys()].sort();
    console.log(
      `${index.dims.map((d) => `${d}=${JSON.stringify(s.dims[d])}`).join(" ")}  ${dates[0]}..${dates[dates.length - 1]} (${dates.length})`,
    );
    n++;
  }
  console.log(`${n} series (run #${ok.id})`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") usage();
  const flag = (name: string) => rest.includes(name);
  const value = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const values = (name: string) =>
    rest.flatMap((a, i) => (a === name && rest[i + 1] ? [rest[i + 1]] : []));
  const arg = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
  const print = (msg: string) => console.log(msg);

  switch (command) {
    case "list":
      return list();
    case "fetch": {
      if (!arg) usage();
      const out = await runFetch(arg, {
        force: flag("--force"),
        full: flag("--full"),
        extract: !flag("--no-extract"),
        triggeredBy: "cli",
        log: print,
      });
      console.log(
        JSON.stringify(
          { ...out, extractions: out.extractions.map((e) => e.message) },
          null,
          2,
        ),
      );
      if (
        out.status === "failed" ||
        out.extractions.some((e) => e.status === "failed")
      ) {
        process.exitCode = 1;
      }
      return;
    }
    case "extract": {
      if (!arg) usage();
      const out = await runExtract(arg, {
        force: flag("--force"),
        triggeredBy: "cli",
        log: print,
      });
      console.log(out.message);
      if (out.runId) await showRun(out.runId);
      if (out.status === "failed") process.exitCode = 1;
      return;
    }
    case "runs":
      if (!arg) usage();
      return runs(arg, Number(value("--limit") ?? 15));
    case "run":
      if (!arg) usage();
      return showRun(Number(arg));
    case "accept": {
      if (!arg) usage();
      const r = await ExtractionRunCollection.accept(Number(arg), null);
      console.log(
        `run #${r.id} accepted: loads now read it (if it is the latest ok run)`,
      );
      return;
    }
    case "artifacts":
      if (!arg) usage();
      return artifacts(arg, value("--key"));
    case "series":
      if (!arg) usage();
      return series(arg, values("--where"));
    case "google-auth":
      return runGoogleAuth(
        value("--redirect") ?? "http://localhost:3008/api/auth/callback/google",
      );
    default:
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
  process.exit(process.exitCode ?? 0);
} catch (err) {
  reportFatal("ingest-cli crashed", err);
}
