/**
 * HiCentral detail-page parser. Pure: HTML string in, NormalizedListing out.
 *
 * The page has no tables — the data is ~14 <dl>s of <dt>key:</dt><dd>value</dd>
 * pairs, plus a handful of header fields (status, prices, address, remarks,
 * agent) that live outside the <dl>s. The dt/dd mapping is driven entirely by
 * MLS_COLUMNS: a key with a `hicentralKey` entry lands in its column, anything
 * else is kept verbatim in `extra` so an unanticipated key is never lost.
 */

import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import { MLS_COLUMNS } from "../../columns";
import type { MlsColumnKind, MlsColumnName } from "../../columns";
import {
  cleanText,
  decodeResidualEntities,
  normalizeStatus,
  normalizeValue,
  parseMoney,
  parseTenure,
  parseText,
  splitLeadingInt,
} from "../../normalize";
import { MlsParseError } from "../../types";
import type { ColumnValue, NormalizedListing } from "../../types";

/** Every listing HiCentral serves — neighbor islands included — is HBR-numbered. */
const MLS_BOARD = "HBR" as const;
const MLS_NUMBER_KEY = "MLS #";
const OPEN_HOUSE_KEY = "PUBLIC";
const PARKING_KEY = "Parking Stalls";
const MULTI_VALUE_SEPARATOR = "; ";

/**
 * Header facts that have no column in MLS_COLUMNS. They are not <dt> keys, but
 * types.ts says anything the site exposes without a column goes in `extra`.
 */
export const HICENTRAL_HEADER_EXTRA_KEYS = ["Virtual Tour"] as const;

interface KeySpec {
  column: MlsColumnName;
  kind: MlsColumnKind;
}

const KEY_TO_SPEC: ReadonlyMap<string, KeySpec> = new Map(
  MLS_COLUMNS.filter((s) => s.hicentralKey !== null).map((s) => [
    s.hicentralKey as string,
    { column: s.column, kind: s.kind },
  ]),
);

type Fields = NormalizedListing["fields"];

/** "Bedrooms: " → "Bedrooms"; "Home Exempt.: " → "Home Exempt."; "Land Tenure" as is. */
function cleanKey(raw: string): string {
  return cleanText(raw).replace(/\s*:$/, "").trim();
}

/** Element text with the site's double-encoded entities fully decoded. */
function textOf(el: HTMLElement | null | undefined): string {
  return el ? decodeResidualEntities(el.text) : "";
}

function nextElement(el: HTMLElement): HTMLElement | null {
  return el.nextElementSibling ?? null;
}

/**
 * One open house → "Friday, September 18, 2026 10:00 AM - 5:00 PM". Only the
 * date and time spans are kept: the third span is free-text access notes that
 * routinely carry agent phone numbers / emails, and the fourth is "online
 * event" boilerplate the site renders (hidden) on every entry.
 */
function openHouseText(dd: HTMLElement): string | null {
  const date = dd.querySelector(".P-OpenHouse1");
  const time = dd.querySelector(".P-OpenHouse2");
  if (date || time) {
    return parseText([textOf(date), textOf(time)].join(" "));
  }
  return parseText(textOf(dd));
}

/** Keep the first non-null value when a (non-repeating) key shows up twice. */
function setField(fields: Fields, column: MlsColumnName, value: ColumnValue) {
  if (fields[column] === undefined || fields[column] === null) {
    fields[column] = value;
  }
}

function appendJoined(
  target: Record<string, ColumnValue | undefined>,
  key: string,
  value: string | null,
) {
  if (value === null) {
    if (target[key] === undefined) target[key] = null;
    return;
  }
  const prev = target[key];
  target[key] =
    typeof prev === "string" && prev !== ""
      ? `${prev}${MULTI_VALUE_SEPARATOR}${value}`
      : value;
}

/**
 * `<h2>[<nobr><a>Building</a></nobr><br>]4819 Kahala Ave #C<br>Honolulu, HI 96816</h2>`
 */
function parseAddressHeader(h2: HTMLElement | null): {
  building: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  const out = {
    building: null as string | null,
    address: null as string | null,
    city: null as string | null,
    state: null as string | null,
    zip: null as string | null,
  };
  if (!h2) return out;

  const lines: string[] = [];
  for (const segment of h2.innerHTML.split(/<br\s*\/?>/i)) {
    const isBuilding = /haBuildingName|<nobr/i.test(segment);
    const text = parseText(textOf(parse(segment)));
    if (text === null) continue;
    if (isBuilding && out.building === null) out.building = text;
    else lines.push(text);
  }

  const last = lines[lines.length - 1];
  const m = last
    ? /^(.*?),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(last)
    : null;
  if (m) {
    lines.pop();
    out.city = parseText(m[1].replace(/,\s*$/, ""));
    out.state = m[2].toUpperCase();
    out.zip = m[3];
  }
  // Listings that withhold the address render the literal "Address unavailable".
  const address = parseText(lines.join(", "));
  out.address =
    address !== null && /^address\s+(unavailable|withheld)/i.test(address)
      ? null
      : address;
  return out;
}

/** The <p> that follows the <h3> whose text starts with `heading`. */
function paragraphAfterHeading(
  root: HTMLElement,
  heading: string,
): HTMLElement | null {
  const want = heading.toLowerCase();
  for (const h3 of root.querySelectorAll("h3")) {
    if (!cleanText(textOf(h3)).toLowerCase().startsWith(want)) continue;
    let el = nextElement(h3);
    while (el && el.tagName !== "P") {
      if (el.tagName === "H3") break;
      el = nextElement(el);
    }
    if (el && el.tagName === "P") return el;
  }
  return null;
}

export function parseDetail(html: string): NormalizedListing | null {
  const root = parse(html);
  const dts = root.querySelectorAll("dt");

  // "Listing Not Found … may no longer be available or valid" — served as 200.
  if (dts.length === 0 && /no longer/i.test(html)) return null;

  const fields: Fields = {};
  const extra: Record<string, string> = {};
  let mlsNumber: string | null = null;

  // ── dt/dd pair walk ───────────────────────────────────────────────────
  for (const dt of dts) {
    const key = cleanKey(textOf(dt));
    if (!key) continue;
    const dd = nextElement(dt);
    if (!dd || dd.tagName !== "DD") continue;

    if (key === MLS_NUMBER_KEY) {
      mlsNumber ??= parseText(textOf(dd));
      continue;
    }

    if (key === OPEN_HOUSE_KEY) {
      appendJoined(fields, "open_house", openHouseText(dd));
      continue;
    }

    if (key === PARKING_KEY) {
      const { n, rest } = splitLeadingInt(textOf(dd));
      setField(fields, "parking_stalls", n);
      setField(fields, "parking_stalls_desc", rest);
      continue;
    }

    const spec = KEY_TO_SPEC.get(key);
    if (spec) {
      setField(fields, spec.column, normalizeValue(spec.kind, textOf(dd)));
      continue;
    }

    // No column for this key: keep the raw value verbatim; "--" carries nothing.
    const rawValue = textOf(dd).trim();
    if (parseText(rawValue) !== null) {
      extra[key] =
        extra[key] === undefined
          ? rawValue
          : `${extra[key]}${MULTI_VALUE_SEPARATOR}${rawValue}`;
    }
  }

  if (mlsNumber === null) {
    throw new MlsParseError("hicentral detail: page has no 'MLS #' field");
  }
  if (!/^\d{9}$/.test(mlsNumber)) {
    throw new MlsParseError(
      `hicentral detail: MLS # '${mlsNumber}' is not a 9-digit HBR number`,
    );
  }

  // ── Header: status ────────────────────────────────────────────────────
  const statusRaw = parseText(
    textOf(root.querySelector("#ctl00_main_ctl00_divListStatus")),
  );
  const status = normalizeStatus(statusRaw);

  // ── Header: price boxes ───────────────────────────────────────────────
  let listPriceRaw: string | null = null;
  let soldPriceRaw: string | null = null;
  for (const box of root.querySelectorAll(".price-box")) {
    const label = cleanText(textOf(box.querySelector(".text"))).toLowerCase();
    const priceEl = box.querySelector(".price");
    const price = priceEl ? textOf(priceEl) : null;
    if (label.startsWith("list")) listPriceRaw ??= price;
    else if (label.startsWith("sold")) soldPriceRaw ??= price;
  }
  fields.list_price = parseMoney(listPriceRaw);
  fields.sold_price = parseMoney(soldPriceRaw);
  fields.tenure = parseTenure(listPriceRaw) ?? parseTenure(soldPriceRaw);

  // ── Header: address ───────────────────────────────────────────────────
  const header = parseAddressHeader(
    root.querySelector("#content .heading h2") ??
      root.querySelector(".heading h2"),
  );
  fields.address = header.address;
  fields.city = header.city;
  fields.state = header.state;
  fields.zip = header.zip;
  fields.building_name = header.building;

  // ── Text blocks ───────────────────────────────────────────────────────
  fields.remarks = parseText(textOf(paragraphAfterHeading(root, "REMARKS")));
  fields.sale_conditions = parseText(
    textOf(paragraphAfterHeading(root, "Sale Conditions")),
  );
  const virtualTour = parseText(
    textOf(paragraphAfterHeading(root, "Virtual Tour")),
  );
  if (virtualTour !== null) extra["Virtual Tour"] = virtualTour;

  // ── Listing agent (name + brokerage only — never phone/email) ─────────
  const agent = root.querySelector("#ctl00_main_ctl00_divListAgent");
  fields.listing_agent = parseText(
    textOf(agent?.querySelector(".realtor-name")),
  );
  const officeEm = agent
    ?.querySelectorAll(".realtor-title em")
    .find((em) => !em.classList.contains("realtor-designations"));
  fields.listing_office = parseText(textOf(officeEm));

  return { mlsBoard: MLS_BOARD, mlsNumber, status, statusRaw, fields, extra };
}
