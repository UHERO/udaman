import {
  closeBrowser,
  getPage,
  releasePage,
} from "@/core/crawlers/qpub/browser";
import { getIslandCode } from "@/core/crawlers/qpub/config";
import { scrapeTmk } from "@/core/crawlers/qpub/scrape";
import { rawQuery } from "@/lib/mysql/hhdb";

export type ScrapeResult = {
  status: "success" | "captcha" | "blocked" | "error";
  error?: string;
};

export async function processScrape(
  data: { tmk: string; url: string; island: string },
  log: (msg: string) => void,
): Promise<ScrapeResult> {
  const { tmk, url } = data;

  const page = await getPage();
  try {
    const result = await scrapeTmk(page, tmk, url);
    log(
      `${tmk}: ${result.status}${result.error ? ` (${result.error})` : ""}`,
    );

    if (result.status === "success" || result.status === "no_data") {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='success', scraped_at=NOW(), retry_count=0, error=NULL
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
      await closeBrowser();
      return { status: result.status, error: result.error ?? "detected" };
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
    await releasePage(page);
  }
}
