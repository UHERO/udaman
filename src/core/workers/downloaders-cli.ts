import { createInterface } from "node:readline/promises";

import DownloaderCollection from "@catalog/collections/downloader-collection";
import { formatHst } from "@catalog/utils/time";

import { consentUrl, exchangeCode } from "@/core/downloaders/google-sheets";
import { resolveRefs } from "@/core/downloaders/keys";
import { DOWNLOADERS, getImpl } from "@/core/downloaders/registry";
import { runDownloader } from "@/core/downloaders/run";
import { createLogger } from "@/core/observability/logger";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

const log = createLogger("downloaders-cli");

function usage(): never {
  console.log(`
Usage: bun run downloaders <command> [options]

  list                     Downloaders with their status
  run <handle>             Run a downloader in this process (not the queue)
      --keys a,b           Keyed run (bls_api: only these BLS series)
      --force              Ignore skip-if-unchanged shortcuts (re-parse)
      --full               Ignore historical marks / history: refetch everything
  refs <handle>            Load statements that call the downloader's load
                           method, with the key each resolves to
  google-auth              Mint GOOGLE_SHEETS_REFRESH_TOKEN for dotax_sheet
      --redirect <uri>     Redirect URI registered on the OAuth client
                           (default http://localhost:3008/api/auth/callback/google)

Handles: ${Object.keys(DOWNLOADERS).join(", ")}
`);
  process.exit(1);
}

async function list() {
  for (const d of await DownloaderCollection.list()) {
    console.log(
      [
        d.handle.padEnd(16),
        d.enabled ? "enabled " : "disabled",
        `last success ${formatHst(d.lastSuccessAt)}`,
        `last change ${formatHst(d.lastChangeAt)}`,
        d.lastError ? `error: ${d.lastError.slice(0, 80)}` : "",
      ].join("  "),
    );
  }
}

async function refs(handle: string) {
  const impl = getImpl(handle);
  const resolved = resolveRefs(
    impl,
    await DownloaderCollection.getLoaderRefs(impl.loadMethod),
  );
  for (const r of resolved) {
    console.log(
      `${r.seriesName ?? "?"} (loader ${r.loaderId}): ${r.error ?? r.keys.map((k) => k.key).join(", ")}`,
    );
  }
  console.log(`${resolved.length} load statement(s)`);
}

/**
 * Catch the OAuth redirect ourselves: listen on the redirect URI's port and
 * path (the dev server must be stopped — otherwise NextAuth takes the
 * callback and the code is lost), falling back to pasting the URL.
 */
async function captureCode(redirect: string): Promise<string | null> {
  const url = new URL(redirect);
  let server: ReturnType<typeof Bun.serve>;
  let resolve!: (code: string | null) => void;
  const got = new Promise<string | null>((r) => (resolve = r));
  try {
    server = Bun.serve({
      port: Number(url.port || 80),
      hostname: url.hostname,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname !== url.pathname)
          return new Response("", { status: 404 });
        const code = u.searchParams.get("code");
        const error = u.searchParams.get("error");
        resolve(code);
        return new Response(
          code
            ? "Got it — return to the terminal. You can close this tab."
            : `Google returned an error: ${error ?? "no code"}`,
        );
      },
    });
  } catch {
    console.log(
      `
(Port ${url.port} is in use — stop the dev server to have the code captured automatically.)`,
    );
    return null;
  }
  console.log(`Waiting for the redirect on ${redirect} ...`);
  const code = await got;
  server.stop();
  return code;
}

async function googleAuth(redirect: string) {
  console.log(
    `
Open this URL signed in as an account the sheet is shared with:\n\n${consentUrl(redirect)}\n`,
  );
  let code = await captureCode(redirect);
  if (!code) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(
      "Paste the redirected URL containing ?code= (from the address bar or browser history): ",
    );
    rl.close();
    code = answer.includes("code=")
      ? (new URL(answer.trim()).searchParams.get("code") ?? "")
      : answer.trim();
  }
  const token = await exchangeCode(code, redirect);
  console.log(
    `\nAdd to the worker's environment:\n\nGOOGLE_SHEETS_REFRESH_TOKEN=${token}\n`,
  );
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") usage();
  const flag = (name: string) => rest.includes(name);
  const value = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  switch (command) {
    case "list":
      return list();
    case "run": {
      const handle = rest[0];
      if (!handle || handle.startsWith("--")) usage();
      try {
        const out = await runDownloader(handle, {
          keys: value("--keys")
            ?.split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          force: flag("--force"),
          full: flag("--full"),
          log: (msg) => console.log(msg),
        });
        console.log(JSON.stringify(out, null, 2));
        if (out.status === "error") process.exitCode = 1;
      } catch (e) {
        // already recorded on the downloaders row (last_error)
        console.error(
          `${handle} failed: ${e instanceof Error ? e.message : e}`,
        );
        process.exitCode = 1;
      }
      return;
    }
    case "refs": {
      if (!rest[0]) usage();
      return refs(rest[0]);
    }
    case "google-auth":
      return googleAuth(
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
  reportFatal("downloaders-cli crashed", err);
}
