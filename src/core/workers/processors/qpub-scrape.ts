import { getPage, releasePage } from "@/core/crawlers/qpub/browser";
import { scrapeTmk } from "@/core/crawlers/qpub/scrape";
import { rawQuery } from "@/lib/mysql/hhdb";

import { tagWithWorker } from "../worker-identity";

import { enqueueCondoUnits } from "./qpub-enqueue";

import type { Page } from "playwright-core";

export type ScrapeResult = {
  status: "success" | "captcha" | "blocked" | "error";
  error?: string;
  page?: Page; // set when captcha/blocked — caller owns this page
  /** The HTML couldn't be written to disk — the runner should stop. */
  storageFailure?: boolean;
  /**
   * The fetch succeeded but qPublic has no parcel at this TMK. Reported as a
   * success — it was a good request, and it resets the captcha streak — with
   * this flag for counting.
   */
  noRecord?: boolean;
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

    if (result.status === "no_record") {
      // Terminal: the county answered, and the answer is that no parcel exists
      // here. Retired from the scrape, parse and load queues rather than
      // deleted — the row records that we asked. parse/load are left alone so
      // the nightly's no_results guard, not a 'failed' status, keeps them out.
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='success', scraped_at=NOW(), retry_count=0,
             no_results=1, no_results_at=NOW(), error=?
         WHERE tmk = ?`,
        [tagWithWorker("no qPublic record for this TMK"), tmk],
      );
      return { status: "success", noRecord: true };
    }

    if (result.status === "success" || result.status === "no_data") {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='success', scraped_at=NOW(), retry_count=0, error=NULL,
             parse_status='pending', load_status='pending'
         WHERE tmk = ?`,
        [tmk],
      );

      // A condo master is the only place the county publishes its units, so
      // this is the one chance to learn they exist. Queued here rather than at
      // load time so a unit discovered today is scrapeable today.
      if (result.condoMasterHtml) {
        try {
          const queued = await enqueueCondoUnits(tmk, result.condoMasterHtml);
          if (queued > 0) log(`${tmk}: queued ${queued} condo units`);
        } catch (e) {
          // The scrape succeeded and the HTML is saved; a failure to enqueue
          // is recoverable later by the backfill, and must not turn a good
          // scrape into a retry.
          const msg = e instanceof Error ? e.message : String(e);
          log(`${tmk}: condo unit enqueue failed (${msg})`);
        }
      }

      return { status: "success" };
    } else if (result.status === "captcha" || result.status === "blocked") {
      await rawQuery(
        `UPDATE scrape_status
         SET retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        // Tagged with the worker: several machines share this table, and the
        // dashboard renders the error column verbatim.
        [tagWithWorker(result.error ?? result.status), tmk],
      );
      handedOff = true;
      return { status: result.status, error: result.error ?? "detected", page };
    } else {
      // error status — including a scrape that fetched fine but couldn't be
      // saved. Nothing was written, so it counts as a failure either way and
      // has to be picked up again on a later pass.
      const error = result.error ?? "Unknown scrape error";
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status='failed', retry_count = retry_count + 1, error = ?
         WHERE tmk = ?`,
        [tagWithWorker(error), tmk],
      );
      return { status: "error", error, storageFailure: result.storageFailure };
    }
  } finally {
    if (!handedOff) {
      await releasePage(page);
    }
  }
}
