import { rawQuery } from "@/lib/mysql/hhdb";

const STALE_MONTHS = 6;
const CLAIM_TIMEOUT_MINUTES = 5;
const MAX_RETRIES = 10;
const MAX_CLAIM_SIZE = 50;

function authenticate(req: Request): boolean {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return false;

  const header = req.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] === key;
}

export async function GET(req: Request) {
  if (!authenticate(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const size = Math.min(
    Math.max(1, parseInt(url.searchParams.get("size") ?? "10", 10) || 10),
    MAX_CLAIM_SIZE,
  );

  try {
    const rows = await rawQuery<{ tmk: string; island_code: string }>(
      `SELECT s.tmk, p.island_code
       FROM scrape_status s
       JOIN properties p ON s.tmk = p.tmk
       WHERE (s.scraped_at < NOW() - INTERVAL ${STALE_MONTHS} MONTH OR s.scraped_at IS NULL)
         AND s.scrape_status != 'pending'
         AND s.updated_at < NOW() - INTERVAL ${CLAIM_TIMEOUT_MINUTES} MINUTE
         AND s.retry_count < ${MAX_RETRIES}
       ORDER BY s.scraped_at ASC
       LIMIT ${size}
       FOR UPDATE SKIP LOCKED`,
    );

    if (rows.length === 0) {
      return Response.json({ items: [] });
    }

    // Mark claimed items as pending
    const tmks = rows.map((r) => r.tmk);
    const placeholders = tmks.map(() => "?").join(",");
    await rawQuery(
      `UPDATE scrape_status
       SET scrape_status = 'pending', error = NULL
       WHERE tmk IN (${placeholders})`,
      tmks,
    );

    return Response.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[scraper/claim] Error:", msg);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
