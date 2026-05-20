import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { getHtmlPath, getJsonPath } from "@/core/crawlers/qpub/config";
import { parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { rawQuery } from "@/lib/mysql/hhdb";

export async function processParse(
  data: { tmk: string; island: string },
  log: (msg: string) => void,
): Promise<string> {
  const { tmk } = data;

  try {
    // Read HTML from NAS
    const htmlDir = getHtmlPath(tmk);
    const htmlFile = path.join(htmlDir, `${tmk}.html`);

    if (!existsSync(htmlFile)) {
      await rawQuery(
        `UPDATE scrape_status SET parse_status='failed', error=? WHERE tmk=?`,
        [`HTML file not found: ${htmlFile}`, tmk],
      );
      throw new Error(`HTML file not found: ${htmlFile}`);
    }

    const html = readFileSync(htmlFile, "utf-8");

    // Parse the HTML
    const parsed = parsePropertyHTML(html, tmk);

    // If status is not success or condo_project, mark as failed
    if (parsed.status !== "success" && parsed.status !== "condo_project") {
      await rawQuery(
        `UPDATE scrape_status SET parse_status='failed', error=? WHERE tmk=?`,
        [`Page status: ${parsed.status}`, tmk],
      );
      log(`${tmk}: parse skipped (status: ${parsed.status})`);
      return `${tmk}: parse skipped (${parsed.status})`;
    }

    // Write JSON to NAS
    const jsonDir = getJsonPath(tmk);
    if (!existsSync(jsonDir)) {
      mkdirSync(jsonDir, { recursive: true });
    }
    const jsonFile = path.join(jsonDir, `${tmk}.json`);
    writeFileSync(jsonFile, JSON.stringify(parsed, null, 2));

    // Update status
    await rawQuery(
      `UPDATE scrape_status SET parse_status='success', parsed_at=NOW(), error=NULL WHERE tmk=?`,
      [tmk],
    );

    log(`${tmk}: parsed → ${jsonFile}`);
    return `${tmk}: parsed`;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await rawQuery(
      `UPDATE scrape_status SET parse_status='failed', error=? WHERE tmk=?`,
      [errorMsg.slice(0, 500), tmk],
    );
    throw e;
  }
}
