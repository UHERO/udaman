/**
 * Street addresses reduced to a comparable key, and an index of the qPublic
 * site addresses (properties.location_address) by that key. Shared by the
 * loaders that geocode by address (renthub, ficoh).
 *
 * Both sides are messy in different ways — listings: "1000 Auahi St #3305",
 * "629 Ke'eaumoku St Unit # 1605"; qPublic: "1212 NUUANU AVE 2601",
 * "3343 KEHA DR KIHEI HI 96753", "15-1852 7TH AVENUE", "91- 4099 HIKUONO ST",
 * "709 B KIHAPAI ST". The key keeps only what identifies the lot: the house
 * number (hyphen dropped) and the street name without its suffix, unit,
 * directional, okina, city or zip — {num: "914099", street: "hikuono"}.
 */

/** A query function: rawQuery (remote hhdb) or localRawQuery (rebuild DB). */
export type Db = <T = Record<string, unknown>>(
  sql: string,
  params?: (string | number | Date | null)[],
) => Promise<T[]>;

export interface AddressKey {
  /** House number, zone prefix included ("94-207" → "94207"). */
  num: string;
  /** Street name without suffix, directional, okina or spaces. */
  street: string;
  /** Lot letter / sub-number: "709 B KIHAPAI", "921c", "1294-A", "1430-2". */
  lot?: string;
  /** Unit, alphanumerics only: "#9-K" → "9k", "APT 3512" → "3512", "A/101" → "a101". */
  unit?: string;
}

/** Street-type words; the name ends where one appears. */
const SUFFIXES = new Set(
  (
    "st street ave av avenue rd road pl place hwy highway hiway dr drive " +
    "blvd boulevard ln lane loop lp way wy cir circle ct court pkwy parkway " +
    "ter terrace trl trail sq square mall walk wk aly alley path cres " +
    "crescent spur row xing"
  ).split(" "),
);
/** Unit designators; the name ends here too. */
const UNIT_WORDS = new Set(
  "unit apt apartment # ste suite bldg building rm room no ph u".split(" "),
);
/** Words abbreviated inconsistently inside street names. */
const ABBREVIATIONS: Record<string, string> = {
  heights: "hts",
  mount: "mt",
  fort: "ft",
  saint: "st",
  lwr: "lower",
};
const DIRECTIONALS = new Set("n s e w so north south east west".split(" "));

/** First token: "1700", "94-207", "4-820", "921c", "572-a", "1430-2". */
function parseNumber(t: string): { num: string; lot?: string } | null {
  // Zone-prefixed (1–2 digit prefix): "68-036" and "68-36" are the same house;
  // so is an unhyphenated "87108".
  let m = /^(\d{1,2})-(\d+)([a-z])?$/.exec(t);
  if (m) return { num: m[1] + m[2].padStart(3, "0"), lot: m[3] };
  m = /^(\d+)-([a-z0-9]+)$/.exec(t);
  if (m) return { num: m[1], lot: m[2] };
  m = /^(\d+)([a-z])?$/.exec(t);
  return m ? { num: m[1], lot: m[2] } : null;
}

export function normalizeAddress(raw: string | null): AddressKey | null {
  if (!raw) return null;
  const s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u02bb\u2018\u2019'`]/g, "")
    // The vendor's export lost ʻokina and macrons as "?" ("Kal?kaua", "Hawai?i").
    .replace(/\?/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+hi(awaii)?\s+967\d\d(-\d{4})?\s*$/, "")
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
    // Hawaiian zone-prefixed numbers written with a space: "95 1061 ALAKAINA
    // ST" is 95-1061. Only a leading 1–2 digit prefix + 1–4 digit number.
    .replace(/^(\d{1,2}) (\d{1,4}) (?=[a-z])/, "$1-$2 ")
    // Maui's Lower Honoapiilani Rd, written "L HONOAPIILANI".
    .replace(/(^|\s)l\s+(?=honoapiilani)/, "$1lower ")
    .replace(/#/g, " # ");
  const tokens = s.split(/\s+/).filter(Boolean);
  const number = parseNumber(tokens[0] ?? "");
  if (!number) return null;
  let lot = number.lot;

  let i = 1;
  // Lot letter ("709 B KIHAPAI ST"), directional ("517 W PAPA AVE") or a
  // lone "-" ("312 - B Holua"), before the street name.
  for (; i + 1 < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-" || DIRECTIONALS.has(t)) continue;
    if (/^[a-z]$/.test(t)) {
      lot ??= t;
      continue;
    }
    break;
  }
  const core: string[] = [];
  for (; i < tokens.length; i++) {
    // "Mott-smith" / "MOTT SMITH".
    const t = tokens[i].replace(/-/g, "");
    if (!t) continue;
    if (SUFFIXES.has(t) && core.length) break;
    if (UNIT_WORDS.has(t) && core.length) break;
    // A trailing unit number ("NUUANU AVE 2601"), but not "7TH AVENUE".
    if (/^\d/.test(t) && !/^\d+(st|nd|rd|th)$/.test(t)) break;
    core.push(ABBREVIATIONS[t] ?? t);
  }
  const street = core.join("");
  if (!street) return null;

  // Unit: the first token with a digit after the street ("AVE 2601",
  // "#3713", "PKWY H340", "UNIT C221", "A/101"), or a bare letter right after
  // a unit word ("UNIT B"). City names and the zip never count.
  let unit: string | undefined;
  let afterUnitWord = false;
  for (let j = i; j < tokens.length; j++) {
    const t = tokens[j].replace(/[^a-z0-9]/g, "");
    if (!t) continue;
    if (UNIT_WORDS.has(t) || tokens[j] === "#") {
      afterUnitWord = true;
      continue;
    }
    if (j === i && SUFFIXES.has(t)) continue;
    if (/^96[78]\d\d$/.test(t)) break;
    if (/\d/.test(t) || (afterUnitWord && /^[a-z]$/.test(t))) {
      unit = t.replace(/^0+(?=\d)/, "");
      break;
    }
    if (afterUnitWord) break;
  }

  const key: AddressKey = { num: number.num, street };
  if (lot) key.lot = lot;
  if (unit) key.unit = unit;
  return key;
}

/** Levenshtein similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * Whether a listing's street could be a qPublic street: a typo or spelling
 * variant ("kalnaianaole" / "kalanianaole", "kuawi" / "kuaiwi"), or the
 * qPublic name followed by junk the vendor glued on ("pukihae406",
 * "kalanianaoleorchidmanor", "alamoanastreets").
 *
 * Only that direction: a qPublic name LONGER than the listing's is usually a
 * different street — Makiki St / Makiki Heights Dr, Palama St / Old Palama
 * St, Honoapiilani Hwy / Lower Honoapiilani Rd.
 */
export const FUZZY_MIN = 0.8;
export function streetSimilarity(listing: string, qpub: string): number {
  if (qpub.length >= 5 && listing.startsWith(qpub)) return 0.9;
  return similarity(listing, qpub);
}

/** Parcel TMK (CPR 0000) of any properties.tmk. */
export function parcelOf(tmk: string): string | null {
  const head = tmk.trim().slice(0, 13);
  return /^[1-4]-\d-\d-\d{3}-\d{3}$/.test(head) ? `${head}-0000` : null;
}

/** house number → street key → parcel TMK → one qPublic address seen there. */
type Streets = Map<string, Map<string, string>>;

/** How a listing was matched to one condo unit (CPR) on its parcel. */
export type CprMatch = "unit" | "unit_variant" | "house_address";

export interface CprHit {
  /** properties.tmk of the unit, as stored (CPR-level). */
  tmk: string;
  /** That unit's qPublic site address. */
  address: string;
  match: CprMatch;
}

/** The CPR (unit-level) rows of one condo parcel, by unit and by house. */
interface ParcelCprs {
  units: Map<string, Map<string, string>>;
  houses: Map<string, Map<string, string>>;
}

/**
 * Spellings of a unit number to retry when the unit itself is not found:
 * a tower / room prefix ("k1142", "rm516" → "1142", "516"), a trailing letter
 * ("1404a" → "1404"), and penthouse ("ph8" → "8").
 */
export function unitVariants(unit: string): string[] {
  return [
    ...new Set([
      unit.replace(/^[a-z]+(?=\d)/, ""),
      unit.replace(/(?<=\d)[a-z]+$/, ""),
      unit.replace(/^ph/, ""),
    ]),
  ].filter((v) => v && v !== unit);
}

const houseKey = (k: AddressKey) => `${k.num}|${k.street}|${k.lot ?? ""}`;

export class AddressIndex {
  private readonly byNum = new Map<string, Streets>();
  /** "num|street|unit" → full (CPR-level) properties.tmk → its address. */
  private readonly units = new Map<string, Map<string, string>>();
  /** Parcel TMK → its CPR rows (properties.tmk not ending -0000). */
  private readonly cprs = new Map<string, ParcelCprs>();
  private count = 0;

  /** Distinct (number, street, parcel) entries. */
  get size(): number {
    return this.count;
  }

  add(propertyTmk: string, address: string): boolean {
    const parcel = parcelOf(propertyTmk);
    const key = normalizeAddress(address);
    if (!parcel || !key) return false;
    let streets = this.byNum.get(key.num);
    if (!streets) this.byNum.set(key.num, (streets = new Map()));
    let parcels = streets.get(key.street);
    if (!parcels) streets.set(key.street, (parcels = new Map()));
    if (!parcels.has(parcel)) {
      parcels.set(parcel, address.trim());
      this.count++;
    }
    const tmk = propertyTmk.trim();
    if (key.unit) {
      const k = `${key.num}|${key.street}|${key.unit}`;
      let cprs = this.units.get(k);
      if (!cprs) this.units.set(k, (cprs = new Map()));
      cprs.set(tmk, address.trim());
    }
    if (!tmk.endsWith("-0000")) {
      let p = this.cprs.get(parcel);
      if (!p)
        this.cprs.set(parcel, (p = { units: new Map(), houses: new Map() }));
      const put = (m: Map<string, Map<string, string>>, k: string) => {
        let at = m.get(k);
        if (!at) m.set(k, (at = new Map()));
        at.set(tmk, address.trim());
      };
      if (key.unit) put(p.units, key.unit);
      put(p.houses, houseKey(key));
    }
    return true;
  }

  /**
   * The one condo unit (CPR) on `parcel` this address names, if exactly one:
   *   unit           the listing's unit number is a unit on the parcel
   *   unit_variant   a spelling of it is ("K1142" → 1142, "PH8" → 8)
   *   house_address  no unit given, but on a CPR'd lot of houses the
   *                  address itself belongs to one unit ("87-2131 PAKEKE ST")
   * Only the parcel already matched is searched, and two or more candidates
   * is no match: the same unit number in two buildings, or a building
   * address shared by every unit.
   */
  matchCpr(parcel: string, key: AddressKey): CprHit | null {
    const p = this.cprs.get(parcel);
    if (!p) return null;
    const only = (m: Map<string, string> | undefined, match: CprMatch) => {
      if (m?.size !== 1) return null;
      const [[tmk, address]] = m;
      return { tmk, address, match };
    };
    if (key.unit) {
      const exact = p.units.get(key.unit);
      if (exact) return only(exact, "unit");
      const hits = new Map<string, string>();
      for (const v of unitVariants(key.unit))
        for (const [tmk, addr] of p.units.get(v) ?? []) hits.set(tmk, addr);
      return only(hits, "unit_variant");
    }
    return only(p.houses.get(houseKey(key)), "house_address");
  }

  /**
   * CPR-level TMKs (properties.tmk as stored) whose site address has this
   * number, street and unit — "1001 QUEEN ST APT 3713" → its condo unit.
   */
  unitTmks(key: AddressKey): Map<string, string> | undefined {
    return key.unit
      ? this.units.get(`${key.num}|${key.street}|${key.unit}`)
      : undefined;
  }

  /** Every street with this house number, each with its parcels. */
  streetsWithNumber(num: string): Streets | undefined {
    return this.byNum.get(num);
  }

  static async fromDb(db: Db): Promise<AddressIndex> {
    const rows = await db<{ tmk: string; location_address: string }>(
      `SELECT tmk, location_address FROM properties
       WHERE location_address IS NOT NULL AND location_address <> ''`,
    );
    const index = new AddressIndex();
    for (const r of rows) index.add(r.tmk, r.location_address);
    if (index.size === 0)
      throw new Error("properties has no usable location_address rows");
    return index;
  }
}
