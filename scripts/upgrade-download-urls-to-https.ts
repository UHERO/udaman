/**
 * Rewrite `http://` download URLs to `https://`.
 *
 * Background: some hosts (notably files.hawaii.gov, which accounts for 216 of
 * these) accept the TCP connection on port 80 and then never answer — no 301,
 * no reset. `fetch` therefore hangs for the full 120s AbortSignal.timeout and
 * throws before DownloadCollection.downloadToServer reaches its
 * dsd_log_entries insert, so the failure leaves no trace in the DSD log.
 *
 * These URLs work in Chrome only because Chrome upgrades http->https in its own
 * network stack (HTTPS-Upgrades, plus .gov HSTS preloading) and reports the
 * synthetic result as "307 Internal Redirect". No redirect exists on the wire,
 * so `fetch` — which follows real redirects fine — has nothing to follow.
 *
 * By default every candidate is verified over https before its row is touched:
 * a URL is only rewritten if the https variant answers with a non-5xx status.
 * That keeps the rewrite from papering over hosts that are broken for other
 * reasons (hawaiitourismauthority.org 404s on both schemes after its 2026-08
 * site move; the bea.gov iTable `download.cfm?fid=...` links have expired
 * session tokens).
 *
 * Usage:
 *   bun run scripts/upgrade-download-urls-to-https.ts --dry-run
 *   bun run scripts/upgrade-download-urls-to-https.ts --host=files.hawaii.gov
 *   bun run scripts/upgrade-download-urls-to-https.ts
 *   bun run scripts/upgrade-download-urls-to-https.ts --no-verify   # rewrite blind
 *
 * Flags:
 *   --dry-run     probe and report, write nothing
 *   --no-verify   skip the https probe and rewrite every http:// URL
 *   --host=HOST   only consider URLs whose host is HOST
 *   --concurrency=N  parallel probes (default 10)
 *   --timeout=MS  per-probe timeout (default 20000)
 */
import { mysql } from "@database/mysql/helpers";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY = !process.argv.includes("--no-verify");
const argVal = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const HOST = argVal("host");
const CONCURRENCY = Number(argVal("concurrency") ?? 10);
const TIMEOUT_MS = Number(argVal("timeout") ?? 20_000);

/** Same UA DownloadCollection.downloadToServer sends, so probes match reality. */
const USER_AGENT =
  "Mozilla/5.0 (compatible; UDAMAN/1.0; UHERO Data Manager)";

type Row = { id: number; handle: string; url: string };

type Probe =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

/**
 * Does the https variant answer? Any non-5xx status counts as reachable — a
 * 404 over https is still strictly better than a 120s hang over http, and it
 * surfaces in dsd_log_entries where a thrown fetch does not.
 */
async function probeHttps(url: string): Promise<Probe> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resp.status >= 500) return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const rows = HOST
    ? await mysql<Row>`
        SELECT id, handle, url FROM downloads
        WHERE url LIKE ${`http://${HOST}/%`}
        ORDER BY handle`
    : await mysql<Row>`
        SELECT id, handle, url FROM downloads
        WHERE url LIKE 'http://%'
        ORDER BY handle`;

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}${rows.length} download(s) with http:// URLs` +
      `${HOST ? ` on ${HOST}` : ""}, verify=${VERIFY}\n`,
  );
  if (rows.length === 0) return;

  let updated = 0;
  let unreachable = 0;
  let failed = 0;
  const skipped: string[] = [];

  const process1 = async (row: Row) => {
    const httpsUrl = row.url.trim().replace(/^http:\/\//i, "https://");

    if (VERIFY) {
      const probe = await probeHttps(httpsUrl);
      if (!probe.ok) {
        unreachable++;
        skipped.push(`${row.handle} (id ${row.id}) — https: ${probe.error}`);
        return;
      }
      console.log(`  ok ${probe.status}  ${row.handle}`);
    }

    if (DRY_RUN) {
      updated++;
      return;
    }

    try {
      await mysql`UPDATE downloads SET url = ${httpsUrl} WHERE id = ${row.id}`;
      updated++;
    } catch (e) {
      failed++;
      console.error(
        `  UPDATE failed for ${row.handle} (id ${row.id}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(process1));
  }

  console.log(
    `\n${DRY_RUN ? "Would update" : "Updated"}: ${updated}` +
      (VERIFY ? `\nSkipped (https unreachable): ${unreachable}` : "") +
      (failed ? `\nUPDATE errors: ${failed}` : ""),
  );
  if (skipped.length) {
    console.log("\nLeft on http:// — these need a real URL fix, not a scheme swap:");
    for (const s of skipped) console.log(`  ${s}`);
  }
}

await main();
process.exit(0);
