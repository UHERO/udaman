/**
 * hawaiirealestatesearch.com results-page parser. Pure: HTML in,
 * ListPageResult out.
 *
 * A results page is "N Properties Found. Page X of Y." followed by
 * `<div class="listings columns">` holding 48 cards:
 *
 *   <div class=" article column …" id="listing-410845">
 *     <a class="article__photo" href="https://…/listing/410845-<slug>/"><img data-src="…/ramaui/…"></a>
 *     <a class="save" data-save='{"div":"#listing-410845","mls":"410845","feed":"…"}'></a>
 *     <div class="condo-price-details">$529,000 - 1 Beds, 1.00 Baths, 588 Sf</div>
 *
 * Detail pages reuse the same card markup for "Similar Properties" — this
 * parser is only ever given list pages, and refuses anything without the
 * results counter / search toolbar.
 */

import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import { cleanText, parseIntValue, parseMoney } from "../../normalize";
import { MlsParseError } from "../../types";
import type { ListPageResult, ListRow, MlsBoard } from "../../types";
import { boardFromNumberShape, boardFromPhotoUrl } from "./board";

const CARD_SELECTOR = '.listings .article[id^="listing-"]';
const CARD_ID = /^listing-(\d{5,9})$/;
const COUNTER = /([\d,]+)\s+Propert(?:y|ies)\s+Found/i;
const LISTING_HREF = /\/listing\/(\d{5,9})(?:-[^/?#]*)?\/?(?:[?#].*)?$/;

/** The `mls` inside the card's save-button JSON, or null when absent/garbled. */
function savedMlsNumber(card: HTMLElement): string | null {
  const raw = card.querySelector("[data-save]")?.getAttribute("data-save");
  if (!raw) return null;
  try {
    const mls = (JSON.parse(raw) as { mls?: unknown }).mls;
    return typeof mls === "string" || typeof mls === "number"
      ? String(mls)
      : null;
  } catch {
    return null;
  }
}

/** The card's own `/listing/<mls>-slug/` link (photo and title share it). */
function cardDetailUrl(card: HTMLElement, mlsNumber: string): string | null {
  for (const a of card.querySelectorAll("a")) {
    const href = (a.getAttribute("href") ?? "").trim();
    const m = LISTING_HREF.exec(href);
    if (m && m[1] === mlsNumber) return href;
  }
  return null;
}

function cardBoard(card: HTMLElement, mlsNumber: string): MlsBoard | null {
  for (const img of card.querySelectorAll("img")) {
    const board =
      boardFromPhotoUrl(img.getAttribute("data-src")) ??
      boardFromPhotoUrl(img.getAttribute("src"));
    if (board) return board;
  }
  // No recognizable photo: only HBR's 9-digit shape is unambiguous. HIS and
  // RAM both issue 6-digit numbers, so null sends the pipeline to the detail page.
  return boardFromNumberShape(mlsNumber);
}

export function parseList(html: string): ListPageResult {
  const root = parse(html);

  // "1,875 Properties Found. Page 1 of 40." sits right above the cards.
  let totalCount: number | null = null;
  const counter = COUNTER.exec(cleanText(root.text));
  if (counter) totalCount = parseIntValue(counter[1]);

  // A page past the end (or an island with no listings) has the search
  // toolbar but neither counter nor cards. A detail page or the 404 page has
  // no toolbar — and a detail page DOES have `.listings .article` cards.
  const isResultsPage =
    totalCount !== null || root.querySelector("#search-toolbar") !== null;
  if (!isResultsPage) {
    throw new MlsParseError(
      "hres list: not a results page (no 'N Properties Found' counter and no search toolbar)",
    );
  }

  const rows: ListRow[] = [];
  const seen = new Set<string>();
  for (const card of root.querySelectorAll(CARD_SELECTOR)) {
    const idMatch = CARD_ID.exec(card.getAttribute("id") ?? "");
    if (!idMatch) continue;
    const mlsNumber = idMatch[1];

    const saved = savedMlsNumber(card);
    if (saved !== null && saved !== mlsNumber) {
      throw new MlsParseError(
        `hres list: card id says MLS ${mlsNumber} but its data-save says ${saved}`,
      );
    }
    if (seen.has(mlsNumber)) continue;
    seen.add(mlsNumber);

    const row: ListRow = {
      mlsNumber,
      mlsBoard: cardBoard(card, mlsNumber),
      // Cards carry an "Active" flag only sporadically (3 of 48) and never
      // show "Active Under Contract" — not a usable status.
      status: "unknown",
      listPrice: parseMoney(card.querySelector(".condo-price-details")?.text),
    };
    const detailUrl = cardDetailUrl(card, mlsNumber);
    if (detailUrl !== null) row.detailUrl = detailUrl;
    rows.push(row);
  }

  return { rows, totalCount };
}
