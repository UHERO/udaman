/**
 * Index-page parser. Pure: HTML in, DccaListEntry[] out.
 *
 * The page is one <tbody id="myTable"> of
 *   <tr><td class="link"><a href="/reb/public/result2?reg=N"><h5>NAME</h5></a>
 *       ADDRESS LINE</td></tr>
 * A project can be listed twice under the same registration number with a
 * name variant (e.g. "… (514B, HRS)"); the first row wins and the list is
 * unique by reg.
 */

import { parse } from "node-html-parser";

import { DCCA_BASE_URL } from "./config";
import { cleanText } from "./text";
import { DccaParseError, type DccaListEntry } from "./types";

const REG_RE = /[?&]reg=(\d+)/;

export function parseList(html: string): DccaListEntry[] {
  const root = parse(html);
  const rows = root.querySelectorAll("tbody#myTable tr");
  if (rows.length === 0) {
    throw new DccaParseError("index page has no tbody#myTable rows");
  }

  const seen = new Set<string>();
  const entries: DccaListEntry[] = [];
  for (const tr of rows) {
    const a = tr.querySelector("td.link a[href]");
    const href = a?.getAttribute("href") ?? "";
    const reg = REG_RE.exec(href)?.[1];
    if (!a || !reg) continue;

    const h5 = a.querySelector("h5");
    const name = cleanText(h5?.textContent ?? a.textContent);
    if (!name) continue;

    // The address line is the cell's text once the link (name) is removed.
    const td = tr.querySelector("td.link");
    a.remove();
    const addressLine = cleanText(td?.textContent ?? "") || null;

    if (seen.has(reg)) continue;
    seen.add(reg);
    entries.push({
      reg,
      name,
      addressLine,
      url: new URL(href, DCCA_BASE_URL).toString(),
    });
  }
  return entries;
}
