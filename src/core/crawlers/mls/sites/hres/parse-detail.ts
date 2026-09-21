/**
 * hawaiirealestatesearch.com detail-page parser. Pure: HTML in,
 * NormalizedListing out.
 *
 * All listing data is in `#tab-listingInformation`: `div.keyvals` sections,
 * each an `h2.listing-data__header` plus `div.keyval > strong.keyval__key +
 * span.keyval__val` pairs. A value longer than 30 characters is rendered as
 * its own section instead — `<h2>Appliances</h2><p><strong>…</strong></p>` —
 * and then THE SECTION HEADER IS THE KEY. The mapping from their keys to our
 * columns is the declarative HRES_KEY_MAP below (the code form of §4 of
 * docs/2026-09-19-mls-hres-site.md); a key with no rule lands in `extra`.
 *
 * Scoping. The page also renders up to three "Similar Properties" cards
 * (same markup as list-page cards, often from another MLS) and one MLS
 * disclaimer block per board on the page. Nothing here reads a card. Note
 * that node-html-parser does NOT nest `#tab-listingInformation` under the
 * `#listing-details[data-listing]` container (the site's unbalanced markup
 * flattens the tree), so reads are scoped by the two tab ids, never by
 * "descendant of [data-listing]".
 */

import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import type { MlsColumnKind, MlsColumnName } from "../../columns";
import {
  cleanText,
  decodeResidualEntities,
  normalizeStatus,
  normalizeValue,
  parseText,
} from "../../normalize";
import { MlsParseError } from "../../types";
import type { ColumnValue, MlsBoard, NormalizedListing } from "../../types";
import {
  boardFromDisclaimer,
  boardFromNumberShape,
  boardFromPhotoUrl,
} from "./board";

// ── The mapping table ───────────────────────────────────────────────────

/** Keys whose value needs more than a kind-parse; see DERIVED_HANDLERS. */
export type HresDerivedKey =
  | "mlsNumber"
  | "status"
  | "bathrooms"
  | "acres"
  | "propertyType"
  | "landTenure"
  | "hasPool"
  | "waterfront";

export type HresKeyRule =
  | {
      action: "column";
      column: MlsColumnName;
      kind: MlsColumnKind;
      /**
       * Rule only holds for these boards; on any other board the key goes to
       * `extra` verbatim. (HBR's `Interior` is a flooring list; a RAM or HIS
       * `Interior` would be something else.)
       */
      boards?: readonly MlsBoard[];
      /**
       * Second choice for the column: applied after every primary key, and
       * only when the column is still empty. An unused fallback whose value
       * differs from what the column got is kept in `extra`, never lost.
       */
      fallback?: true;
    }
  | {
      action: "derived";
      handler: HresDerivedKey;
      /** Columns the handler may write — documentation + test surface. */
      columns: readonly MlsColumnName[];
    }
  | { action: "drop"; reason: string };

const col = (
  column: MlsColumnName,
  kind: MlsColumnKind = "text",
): HresKeyRule => ({ action: "column", column, kind });
const fallbackCol = (
  column: MlsColumnName,
  boards?: readonly MlsBoard[],
): HresKeyRule => ({
  action: "column",
  column,
  kind: "text",
  fallback: true,
  ...(boards ? { boards } : {}),
});
const derived = (
  handler: HresDerivedKey,
  ...columns: MlsColumnName[]
): HresKeyRule => ({ action: "derived", handler, columns });

const HBR_ONLY = ["HBR"] as const;

/**
 * Their key (exact text, colon-less) → what happens to it. Keep in step with
 * §4 of docs/2026-09-19-mls-hres-site.md.
 */
export const HRES_KEY_MAP: Readonly<Record<string, HresKeyRule>> = {
  // Essential Information
  "MLS® #": derived("mlsNumber"),
  Price: col("list_price", "money"),
  Status: derived("status"),
  Bedrooms: col("bedrooms", "int"),
  "Full Baths": col("full_baths", "int"),
  "Half Baths": col("half_baths", "int"),
  // "2.50" — split only when Full/Half Baths are both absent (RAM).
  Bathrooms: derived("bathrooms", "full_baths", "half_baths"),
  "Square Footage": col("living_sf", "int"),
  // × 43,560; "0.00" → NULL. Raw kept in extra.Acres when non-zero.
  Acres: derived("acres", "land_area_sf"),
  "Year Built": col("year_built", "year"),
  // Normalized to HiCentral's vocabulary; raw pair kept in extra.
  Type: derived("propertyType", "property_type"),
  "Sub-Type": derived("propertyType", "property_type"),
  "Land Tenure": derived("landTenure", "tenure", "land_tenure"),
  "Description Land Tenure": derived("landTenure", "tenure", "land_tenure"),
  Style: col("building_style"),
  "Assesed Value": col("assd_val_total", "money"), // [sic]

  // Community Information
  Address: col("address"),
  "Building Name": col("building_name"),
  City: col("city"), // HIS puts the district here ("South Hilo", "Puna")
  State: col("state"),
  "Zip Code": col("zip"),
  Area: col("region"),
  Subdivision: col("neighborhood"),
  County: col("island"), // HBR only; otherwise derived from TMK / geo

  // Amenities
  "Parking Spaces": col("parking_stalls", "int"),
  Parking: col("parking_stalls_desc"),
  Garages: fallbackCol("parking_stalls_desc"),
  View: col("view"),
  Pool: col("pool"),
  "Has Pool": derived("hasPool", "pool"), // bare "Yes", only when Pool is absent
  Frontage: col("frontage"),
  Waterfront: derived("waterfront", "frontage"), // RAM; "None" carries nothing
  Amenities: col("amenities"),
  Appliances: col("inclusions"),

  // Interior / Exterior
  "Floor Covering": col("floor_covering"),
  Interior: fallbackCol("floor_covering", HBR_ONLY), // HBR: "Carpet, Vinyl"
  Construction: col("construction"),
  Exterior: fallbackCol("construction", HBR_ONLY), // HBR: "Double Wall, Concrete"
  Roof: col("roofing"),
  Stories: col("number_of_stories"),
  "Lot Description": col("lot_description"),
  Features: fallbackCol("lot_description", HBR_ONLY), // HBR: "Cleared, Level"

  // School Information (HBR)
  Elementary: col("elem_school"),
  Middle: col("middle_school"),
  High: col("high_school"),

  // Additional Information
  "Date Listed": col("list_date", "date"),
  Zoning: col("zoning"),
  "Monthly Maintenance Fees": col("maintenance_fees", "money"),
  "HOA Fees": col("association_fees", "money"),
  "Monthly Lease Fee": col("lease_rent"),
  "Monthly Lease Fees": fallbackCol("lease_rent"),
  "Lease Expires": col("lease_exp"),

  // Listing Details
  Office: col("listing_office"),

  "Days on Market": {
    action: "drop",
    reason:
      "changes daily; would mark every row updated every day (list_date covers it)",
  },
  "Office Contact": {
    action: "drop",
    reason: "agent phone numbers — never stored",
  },
};

/** `extra` keys this parser writes itself (not site keys). */
export const HRES_DERIVED_EXTRA_KEYS = ["Latitude", "Longitude"] as const;

// ── TMK / island ────────────────────────────────────────────────────────

/** qPublic (Schneider) AppID in the County Tax link → TMK island digit. */
export const HRES_TAX_APP_ISLAND_DIGIT: Readonly<Record<string, number>> = {
  "1045": 1, // City & County of Honolulu
  "1029": 2, // Maui County
  "1048": 3, // Hawaii County
  "986": 4, // Kauai County
};

/**
 * 12-digit qPublic KeyValue `ZSPPPpppCCCC` + island digit →
 * `I-Z-S-PPP-ppp-CCCC`, the same shape HiCentral prints
 * (`940070460028` on Oahu → `1-9-4-007-046-0028`).
 */
export function formatTmk(islandDigit: number, keyValue: string): string {
  if (!/^\d{12}$/.test(keyValue)) {
    throw new Error(`hres: TMK KeyValue must be 12 digits, got "${keyValue}"`);
  }
  if (!Number.isInteger(islandDigit) || islandDigit < 1 || islandDigit > 4) {
    throw new Error(`hres: TMK island digit must be 1..4, got ${islandDigit}`);
  }
  return [
    String(islandDigit),
    keyValue.slice(0, 1),
    keyValue.slice(1, 2),
    keyValue.slice(2, 5),
    keyValue.slice(5, 8),
    keyValue.slice(8, 12),
  ].join("-");
}

/**
 * Island name (HiCentral's spelling) from a formatted TMK. Maui County (2)
 * spans three inhabited islands: zone 5 is Molokai, zone 4 section 9 is Lanai.
 */
export function islandFromTmk(tmk: string | null | undefined): string | null {
  const m = /^([1-4])-(\d)-(\d)-/.exec(tmk ?? "");
  if (!m) return null;
  switch (m[1]) {
    case "1":
      return "Oahu";
    case "3":
      return "Hawaii";
    case "4":
      return "Kauai";
    default:
      if (m[2] === "5") return "Molokai";
      if (m[2] === "4" && m[3] === "9") return "Lanai";
      return "Maui";
  }
}

/**
 * County (as the TMK island digit) containing a coordinate; null outside
 * every box. The counties are separated by wide channels, so plain lat/lon
 * boxes are exact for any point on land.
 */
export function countyDigitFromGeo(lat: number, lon: number): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const within = (s: number, n: number, w: number, e: number) =>
    lat >= s && lat <= n && lon >= w && lon <= e;
  if (within(18.85, 20.35, -156.15, -154.75)) return 3; // Hawaii
  if (within(20.45, 21.3, -157.4, -155.9)) return 2; // Maui, Molokai, Lanai
  if (within(21.2, 21.75, -158.35, -157.6)) return 1; // Oahu
  if (within(21.75, 22.3, -160.3, -159.25)) return 4; // Kauai, Niihau
  return null;
}

/** Island name from a coordinate — only used when there is no TMK. */
export function islandFromGeo(lat: number, lon: number): string | null {
  switch (countyDigitFromGeo(lat, lon)) {
    case 1:
      return "Oahu";
    case 3:
      return "Hawaii";
    case 4:
      return "Kauai";
    case 2:
      // Molokai lies wholly north of Maui's northern tip (21.03°N); Lanai
      // wholly west of Maui's western shore (156.70°W) and south of Molokai.
      if (lat >= 21.04) return "Molokai";
      if (lon <= -156.78 && lat >= 20.7) return "Lanai";
      return "Maui";
    default:
      return null;
  }
}

// ── Small helpers ───────────────────────────────────────────────────────

type Fields = NormalizedListing["fields"];

function textOf(el: HTMLElement | null | undefined): string {
  return el ? decodeResidualEntities(el.text) : "";
}

/** "MLS® #:" → "MLS® #". */
function cleanKey(raw: string): string {
  return cleanText(raw).replace(/\s*:$/, "").trim();
}

/** Keep the first non-null value when a key shows up twice. */
function setField(fields: Fields, column: MlsColumnName, value: ColumnValue) {
  if (fields[column] === undefined || fields[column] === null) {
    fields[column] = value;
  }
}

function addExtra(extra: Record<string, string>, key: string, raw: string) {
  const value = raw.trim();
  if (parseText(value) === null) return;
  if (!Object.hasOwn(extra, key)) extra[key] = value;
  else if (extra[key] !== value) extra[key] = `${extra[key]}; ${value}`;
}

const sameText = (a: ColumnValue | undefined, b: string | null) =>
  typeof a === "string" &&
  b !== null &&
  cleanText(a).toLowerCase() === cleanText(b).toLowerCase();

/** "20.984614000000" → "20.984614"; "-156.000" → "-156"; junk / 0 → null. */
function trimDecimal(raw: unknown): string | null {
  const s = typeof raw === "number" ? String(raw) : raw;
  if (typeof s !== "string" || !/^-?\d+(\.\d+)?$/.test(s.trim())) return null;
  if (Number(s) === 0) return null;
  const t = s.trim();
  return t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t;
}

/**
 * Type + Sub-Type → HiCentral's Property Type vocabulary, plus three values
 * HiCentral's public search never shows (Vacant Land, Commercial, Farm).
 * An unrecognized pair passes the Sub-Type (else Type) through verbatim.
 */
export function normalizePropertyType(
  type: string | null,
  subType: string | null,
): string | null {
  const t = (type ?? "").toLowerCase();
  const s = (subType ?? "").toLowerCase();
  // The sold feeds say "Land" where the open feed says "Vacant Land".
  if (t === "vacant land" || t === "land") return "Vacant Land";
  if (t === "commercial") return "Commercial";
  if (s === "condominium" || s === "townhouse") return "Condo/Townhouse";
  if (s === "single family residence" || s === "sf w/det ohana or cottage") {
    return "Single Family";
  }
  if (s === "multi family") return "Multi-Family";
  if (s === "farm" || t === "farm") return "Farm";
  if (t === "condo / townhouse") return "Condo/Townhouse";
  return subType ?? type;
}

/** "FeeSimple" / "Fee Simple" / "Leasehold" → tenure code + display text. */
function normalizeTenure(raw: string | null): {
  tenure: "FS" | "LH" | null;
  landTenure: string | null;
} {
  const squashed = (raw ?? "").replace(/[\s-]+/g, "").toLowerCase();
  if (squashed === "feesimple")
    return { tenure: "FS", landTenure: "Fee Simple" };
  if (squashed === "leasehold")
    return { tenure: "LH", landTenure: "Leasehold" };
  return { tenure: null, landTenure: raw };
}

// ── Page readers ────────────────────────────────────────────────────────

/** Every (key, raw value) pair of the listing's own data tab, in page order. */
function readPairs(tab: HTMLElement): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const section of tab.querySelectorAll(".keyvals")) {
    const header = cleanKey(
      textOf(section.querySelector(".listing-data__header")),
    );
    for (const body of section.querySelectorAll(".keyvals__body")) {
      for (const kv of body.querySelectorAll(".keyval")) {
        const key = cleanKey(textOf(kv.querySelector(".keyval__key")));
        if (key) pairs.push([key, textOf(kv.querySelector(".keyval__val"))]);
      }
      // Long single value: the section header is its key.
      for (const p of body.querySelectorAll("p")) {
        if (header && p.parentNode === body) pairs.push([header, textOf(p)]);
      }
    }
  }
  return pairs;
}

interface ListingJson {
  mls: string | null;
  lat: string | null;
  lon: string | null;
}

/** `<div id="listing-details" data-listing='{"geo":[lat,lon],"mls":"…"}'>`. */
function readListingJson(root: HTMLElement): ListingJson {
  const out: ListingJson = { mls: null, lat: null, lon: null };
  const raw = root
    .querySelector("[data-listing]")
    ?.getAttribute("data-listing");
  if (!raw) return out;
  try {
    const json = JSON.parse(raw) as { mls?: unknown; geo?: unknown };
    if (typeof json.mls === "string" || typeof json.mls === "number") {
      out.mls = String(json.mls);
    }
    if (Array.isArray(json.geo) && json.geo.length === 2) {
      const lat = trimDecimal(json.geo[0]);
      const lon = trimDecimal(json.geo[1]);
      if (lat !== null && lon !== null) {
        out.lat = lat;
        out.lon = lon;
      }
    }
  } catch {
    // Unparseable attribute: no geo, and the MLS # cross-check is skipped.
  }
  return out;
}

/**
 * The listing's own photos: `og:image` metas, the gallery's `data-photos`
 * JSON and the slideshow slides. Never `img[data-src]` — those are the
 * similar-listings cards.
 */
function boardFromOwnPhotos(root: HTMLElement): MlsBoard | null {
  for (const meta of root.querySelectorAll('meta[property="og:image"]')) {
    const board = boardFromPhotoUrl(meta.getAttribute("content"));
    if (board) return board;
  }
  for (const gallery of root.querySelectorAll("[data-photos]")) {
    const board = boardFromPhotoUrl(gallery.getAttribute("data-photos"));
    if (board) return board;
  }
  for (const slide of root.querySelectorAll('[id^="slideshow"] .slide')) {
    const board = boardFromPhotoUrl(slide.getAttribute("style"));
    if (board) return board;
  }
  return null;
}

/**
 * Photo-less listing. The page prints one disclaimer block per board present
 * on it — the listing's and its similar-listings cards' — so only the FIRST
 * board-naming `p.disclaimer` is considered. That block is not always the
 * listing's own (seen: an HBR listing whose first block was HIS), hence the
 * number shape is consulted before it, and a 6-digit number never accepts HBR.
 */
function boardWithoutPhotos(
  root: HTMLElement,
  mlsNumber: string,
): MlsBoard | null {
  const byShape = boardFromNumberShape(mlsNumber);
  if (byShape) return byShape;
  for (const p of root.querySelectorAll("p.disclaimer")) {
    const board = boardFromDisclaimer(textOf(p));
    if (board === null) continue;
    return board === "HBR" ? null : board;
  }
  return null;
}

/** County Tax Information link → { islandDigit, keyValue }, or null. */
function readTaxLink(
  root: HTMLElement,
): { appDigit: number | null; keyValue: string } | null {
  for (const a of root.querySelectorAll("#tab-publicInformation a")) {
    const href = decodeResidualEntities(a.getAttribute("href") ?? "");
    const key = /[?&]KeyValue=(\d{12})(?:&|#|$)/.exec(href);
    if (!key) continue;
    const app = /[?&]AppID=(\d+)/.exec(href);
    return {
      appDigit: app ? (HRES_TAX_APP_ISLAND_DIGIT[app[1]] ?? null) : null,
      keyValue: key[1],
    };
  }
  return null;
}

// ── parseDetail ─────────────────────────────────────────────────────────

export function parseDetail(html: string): NormalizedListing | null {
  const root = parse(html);
  const tab = root.querySelector("#tab-listingInformation");

  if (!tab) {
    // HTTP 404 page: <title>Listing Not Found: MLS® #…</title>, <h1>Listing Not Found</h1>.
    const heading = [
      ...root.querySelectorAll("h1"),
      ...root.querySelectorAll("title"),
    ].some((el) => /listing\s+not\s+found/i.test(textOf(el)));
    if (heading) return null;
    throw new MlsParseError(
      "hres detail: no #tab-listingInformation and not a 'Listing Not Found' page",
    );
  }

  const pairs = readPairs(tab);
  const first = (key: string): string | null => {
    for (const [k, v] of pairs) {
      if (k === key && parseText(v) !== null) return parseText(v);
    }
    return null;
  };

  // ── Identity ──────────────────────────────────────────────────────────
  const listingJson = readListingJson(root);
  const mlsNumber = first("MLS® #");
  if (mlsNumber === null) {
    throw new MlsParseError("hres detail: page has no 'MLS® #' field");
  }
  if (!/^\d{5,9}$/.test(mlsNumber)) {
    throw new MlsParseError(
      `hres detail: MLS # '${mlsNumber}' is not a 5-9 digit number`,
    );
  }
  if (listingJson.mls !== null && listingJson.mls !== mlsNumber) {
    throw new MlsParseError(
      `hres detail: MLS # '${mlsNumber}' disagrees with data-listing mls '${listingJson.mls}'`,
    );
  }

  const mlsBoard =
    boardFromOwnPhotos(root) ?? boardWithoutPhotos(root, mlsNumber);
  if (mlsBoard === null) {
    throw new MlsParseError(
      `hres detail: cannot tell which MLS issued ${mlsNumber} (no feed photo, no board disclaimer)`,
    );
  }

  const statusRaw = first("Status");
  const status = normalizeStatus(statusRaw);

  // ── Key/value walk, driven by HRES_KEY_MAP ────────────────────────────
  const fields: Fields = {};
  const extra: Record<string, string> = {};
  const fallbacks: Array<[string, string, MlsColumnName]> = [];
  const hasSplitBaths =
    first("Full Baths") !== null || first("Half Baths") !== null;
  let propertyTypeDone = false;

  for (const [key, raw] of pairs) {
    const rule = Object.hasOwn(HRES_KEY_MAP, key)
      ? HRES_KEY_MAP[key]
      : undefined;
    if (rule === undefined) {
      addExtra(extra, key, raw);
      continue;
    }
    if (rule.action === "drop") continue;

    if (rule.action === "column") {
      if (rule.boards && !rule.boards.includes(mlsBoard)) {
        addExtra(extra, key, raw);
      } else if (rule.fallback) {
        fallbacks.push([key, raw, rule.column]);
      } else {
        setField(fields, rule.column, normalizeValue(rule.kind, raw));
      }
      continue;
    }

    switch (rule.handler) {
      case "mlsNumber":
      case "status":
        break; // read above
      case "bathrooms": {
        // Redundant next to Full/Half Baths (HIS, HBR); RAM has only this.
        if (hasSplitBaths) break;
        const n = Number(cleanText(raw));
        // "0.00" is the feed's blank (multi-family, land), not "no bathrooms".
        if (!/^\d+(\.\d+)?$/.test(cleanText(raw)) || !(n > 0)) break;
        setField(fields, "full_baths", Math.floor(n));
        setField(fields, "half_baths", n - Math.floor(n) >= 0.5 ? 1 : 0);
        break;
      }
      case "acres": {
        const text = cleanText(raw).replace(/,/g, "");
        const acres = /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
        if (Number.isFinite(acres) && acres > 0) {
          setField(fields, "land_area_sf", Math.round(acres * 43560));
          addExtra(extra, key, raw);
        } else {
          setField(fields, "land_area_sf", null);
        }
        break;
      }
      case "propertyType": {
        addExtra(extra, key, raw);
        if (propertyTypeDone) break;
        propertyTypeDone = true;
        setField(
          fields,
          "property_type",
          normalizePropertyType(first("Type"), first("Sub-Type")),
        );
        break;
      }
      case "landTenure": {
        // `Description Land Tenure` repeats `Land Tenure`; first one wins.
        const { tenure, landTenure } = normalizeTenure(parseText(raw));
        setField(fields, "tenure", tenure);
        setField(fields, "land_tenure", landTenure);
        break;
      }
      case "hasPool":
        fallbacks.push([key, raw, "pool"]);
        break;
      case "waterfront":
        if (!/^(none|no)$/i.test(cleanText(raw))) {
          fallbacks.push([key, raw, "frontage"]);
        }
        break;
    }
  }

  // Second-choice keys: fill the column if still empty; otherwise keep a
  // differing value in `extra`. `Has Pool: Yes` next to a real Pool value
  // says nothing new and is let go.
  for (const [key, raw, column] of fallbacks) {
    const value = parseText(raw);
    const current = fields[column];
    if (current === undefined || current === null) fields[column] = value;
    else if (key !== "Has Pool" && !sameText(current, value)) {
      addExtra(extra, key, raw);
    }
  }

  // ── Geo ───────────────────────────────────────────────────────────────
  let geoDigit: number | null = null;
  if (listingJson.lat !== null && listingJson.lon !== null) {
    extra.Latitude = listingJson.lat;
    extra.Longitude = listingJson.lon;
    geoDigit = countyDigitFromGeo(
      Number(listingJson.lat),
      Number(listingJson.lon),
    );
  }

  // ── TMK + island ──────────────────────────────────────────────────────
  // The island digit comes from the tax link's AppID — unless the listing's
  // own coordinates sit in a different county. The site appears to pick the
  // county app from the ZIP, so a mistyped ZIP yields the wrong app (seen:
  // a Kula, Maui listing with a Big Island ZIP linked to Hawaii County's
  // app). The parcel digits themselves are right in that case.
  const tax = readTaxLink(root);
  if (tax !== null) {
    const digit = geoDigit ?? tax.appDigit;
    if (digit !== null) fields.tmk = formatTmk(digit, tax.keyValue);
  }
  if (fields.island === undefined || fields.island === null) {
    const island =
      islandFromTmk(typeof fields.tmk === "string" ? fields.tmk : null) ??
      (listingJson.lat !== null && listingJson.lon !== null
        ? islandFromGeo(Number(listingJson.lat), Number(listingJson.lon))
        : null);
    if (island !== null) fields.island = island;
  }

  // RAM reports the whole project's land on each condo (12.48 ac on an 894 sf
  // unit). That is not the unit's lot; the raw figure stays in extra.Acres.
  if (mlsBoard === "RAM" && fields.property_type === "Condo/Townhouse") {
    fields.land_area_sf = null;
  }

  // A closed listing shows a single "Price". In the *_sold feeds that is taken
  // to be the closing price (unlabelled on the page — see the 2026-09-19 doc
  // for the query that checks it against list prices we captured while the
  // listing was open). It is not a list price, so it must not sit in
  // list_price; the loader keeps whatever list price we already hold.
  if (status === "sold") {
    fields.sold_price = fields.list_price ?? null;
    delete fields.list_price;
  }

  return { mlsBoard, mlsNumber, status, statusRaw, fields, extra };
}
