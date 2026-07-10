import { getPage, releasePage } from "@/core/crawlers/qpub/browser";
import { scrapeTmk } from "@/core/crawlers/qpub/scrape";
import { rawQuery } from "@/lib/mysql/hhdb";

import type { Page } from "playwright-core";

export type ScrapeResult = {
  status: "success" | "captcha" | "blocked" | "error";
  error?: string;
  page?: Page; // set when captcha/blocked — caller owns this page
};

export async function processScrape(
  data: { tmk: string; url: string; island: string },
  log: (msg: string) => void,
): Promise<ScrapeResult> {
  const { tmk, url } = data;

  const page = await getPage();
  let handedOff = false;
  try {
    const result = await scrapeTmk(page, tmk, url);
    log(`${tmk}: ${result.status}${result.error ? ` (${result.error})` : ""}`);

    if (result.status === "success" || result.status === "no_data") {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='success', scraped_at=NOW(), retry_count=0, error=NULL,
             parse_status='pending', load_status='pending'
         WHERE tmk = ?`,
        [tmk],
      );
      return { status: "success" };
    } else if (result.status === "captcha" || result.status === "blocked") {
      await rawQuery(
        `UPDATE scrape_status
         SET retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        [result.error ?? result.status, tmk],
      );
      handedOff = true;
      return { status: result.status, error: result.error ?? "detected", page };
    } else {
      // error status
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='failed', retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        [result.error ?? "Unknown scrape error", tmk],
      );
      return { status: "error", error: result.error ?? "Unknown scrape error" };
    }
  } finally {
    if (!handedOff) {
      await releasePage(page);
    }
  }
}
