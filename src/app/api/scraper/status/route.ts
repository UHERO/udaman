import { rawQuery } from "@/lib/mysql/hhdb";

function authenticate(req: Request): boolean {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return false;

  const header = req.headers.get("authorization");
  if (!header) return false;

  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] === key;
}

type StatusBody = {
  tmk: string;
  status: "success" | "captcha" | "blocked" | "error";
  error?: string;
};

export async function POST(req: Request) {
  if (!authenticate(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StatusBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tmk, status, error } = body;

  if (!tmk || !status) {
    return Response.json(
      { error: "Missing required fields: tmk, status" },
      { status: 400 },
    );
  }

  try {
    switch (status) {
      case "success": {
        await rawQuery(
          `UPDATE scrape_status
           SET scrape_status = 'success', scraped_at = NOW(), retry_count = 0,
               error = NULL, parse_status = 'pending', load_status = 'pending'
           WHERE tmk = ?`,
          [tmk],
        );
        break;
      }

      case "captcha":
      case "blocked": {
        await rawQuery(
          `UPDATE scrape_status
           SET retry_count = retry_count + 1, error = ?
           WHERE tmk = ?`,
          [error ?? status, tmk],
        );
        break;
      }

      case "error": {
        await rawQuery(
          `UPDATE scrape_status
           SET scrape_status = 'failed', retry_count = retry_count + 1, error = ?
           WHERE tmk = ?`,
          [error ?? "Unknown scrape error", tmk],
        );
        break;
      }

      default:
        return Response.json(
          { error: `Invalid status: ${status}` },
          { status: 400 },
        );
    }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[scraper/status] Error:", msg);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
