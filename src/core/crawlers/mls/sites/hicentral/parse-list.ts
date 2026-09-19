/**
 * HiCentral results-page parser. Pure: HTML string in, ListPageResult out.
 *
 * Each listing is an <li class="P-Active|P-InEscrow|P-Sold"> inside
 * <ul class="P-Results">, separated by <li class="P-Separator">. The MLS
 * number is the bare relative href "?/202617803" — it appears twice per row
 * (photo link + number link), so rows are keyed and deduped on it.
 */

import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import { normalizeStatus, parseIntValue, parseMoney } from "../../normalize";
import { MlsParseError } from "../../types";
import type { ListPageResult, ListRow } from "../../types";

const MLS_HREF = /^\?\/(\d{9})$/;
const COUNTER = /Showing\s+[\d,]+\s*-\s*[\d,]+\s+of\s+([\d,]+)/i;

function rowMlsNumber(li: HTMLElement): string | null {
  for (const a of li.querySelectorAll("a")) {
    const m = MLS_HREF.exec((a.getAttribute("href") ?? "").trim());
    if (m) return m[1];
  }
  return null;
}

export function parseList(html: string): ListPageResult {
  const root = parse(html);

  // "Showing <b>1 - 20</b> of <b>3630</b>" — read off the text so the <b>
  // wrappers and &nbsp; don't matter.
  let totalCount: number | null = null;
  for (const el of root.querySelectorAll(".P-ResultsHeader div")) {
    const m = COUNTER.exec(el.text.replace(/\s+/g, " "));
    if (m) {
      totalCount = parseIntValue(m[1]);
      break;
    }
  }
  if (totalCount === null) {
    const m = COUNTER.exec(root.text.replace(/\s+/g, " "));
    if (m) totalCount = parseIntValue(m[1]);
  }

  const rows: ListRow[] = [];
  const seen = new Set<string>();
  for (const li of root.querySelectorAll("li")) {
    // Nested <li>s don't occur in result rows; skip anything that isn't one.
    const mlsNumber = rowMlsNumber(li);
    if (!mlsNumber || seen.has(mlsNumber)) continue;
    seen.add(mlsNumber);

    const statusRaw = li.querySelector(".P-Results3 span")?.text ?? null;
    const status = normalizeStatus(statusRaw);

    // The big price in a row is the SOLD price once a listing has sold (checked
    // against detail pages), so it is only a list price for unsold rows.
    const priceText =
      li.querySelector(".P-Results2 div")?.text ??
      li.querySelector(".P-Results2")?.text ??
      null;
    const listPrice = status === "sold" ? null : parseMoney(priceText);

    rows.push({ mlsNumber, status, listPrice });
  }

  if (totalCount === null && rows.length === 0) {
    throw new MlsParseError(
      "hicentral list: not a results page (no result counter and no listing rows)",
    );
  }
  return { rows, totalCount };
}
