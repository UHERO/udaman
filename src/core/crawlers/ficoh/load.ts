/**
 * Load the FICOH homeowners policy / claim workbook into insurance_policies
 * and insurance_claims.
 *
 * The workbook is one static delivery, so a load REPLACES both tables:
 * DELETE + INSERT inside one transaction (the hhdb app user has DML rights
 * only, so no staging-table swap). Readers see the old rows until COMMIT.
 * insurance_loads records each load.
 *
 * Neither sheet has coordinates or parcels. tmk is geocoded from the street
 * address alone: the house number + street must match a qPublic site address
 * (properties.location_address) on exactly one parcel in the county the ZIP
 * belongs to (address.ts, hawaii-zips.ts).
 *
 * Claims are linked to the policy row in force on the date of loss
 * (policy_id), choosing among a policy's locations by address.
 */

import { statSync } from "fs";
import path from "path";

import * as XLSX from "xlsx";

import { toHstSql } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";
import { rawQuery, transaction } from "@/lib/mysql/hhdb";
import { localRawQuery, localTransaction } from "@/lib/mysql/hhdb-local";

import {
  AddressIndex,
  FUZZY_MIN,
  normalizeAddress,
  streetSimilarity,
  type Db,
} from "../address";
import { refreshFreqTables, type Tx } from "../freq-refresh";
import { zipCounty } from "../hawaii-zips";
import {
  CLAIM_COLUMNS,
  CLAIM_IGNORED,
  CLAIM_INSERT_COLUMNS,
  FicohParseError,
  mapHeader,
  parseRow,
  POLICY_COLUMNS,
  POLICY_INSERT_COLUMNS,
  type Cell,
  type SqlValue,
} from "./columns";

const log = createLogger("ficoh");

export const DEFAULT_FICOH_FILE =
  "/Volumes/UHEROroot/datashare/ficoh/Data Set for Homeowners policy and Loss.xlsx";
export const POLICY_SHEET = "Policy Data Set";
/** Sic — the delivered workbook's spelling. */
export const CLAIM_SHEET = "Cmail Data Set";

/** Rows per INSERT; ~30 params each stays far under the 65,535 limit. */
const CHUNK_ROWS = 1000;

type Row = Record<string, SqlValue>;

/** Columns the insurance freq tables count by year. */
const FICOH_DATE_COLUMNS: ReadonlySet<string> = new Set(
  [...POLICY_COLUMNS, ...CLAIM_COLUMNS]
    .filter((c) => c.kind === "excelDate" || c.kind === "ymdDate")
    .map((c) => c.column),
);

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function sheetRows(wb: XLSX.WorkBook, name: string): Cell[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new FicohParseError(`workbook has no sheet "${name}"`);
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function parseSheet(
  rows: Cell[][],
  sheet: string,
  specs: typeof POLICY_COLUMNS,
  ignored: readonly string[] = [],
): { row: Row; excelRow: number }[] {
  const [header, ...data] = rows;
  try {
    const index = mapHeader(header ?? [], specs, ignored);
    return data.map((r, i) => {
      try {
        return { row: parseRow(r, index, specs), excelRow: i + 2 };
      } catch (err) {
        if (err instanceof FicohParseError)
          throw new FicohParseError(`row ${i + 2}: ${err.message}`);
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof FicohParseError)
      throw new FicohParseError(`${sheet}: ${err.message}`);
    throw err;
  }
}

/**
 * 15-character numbers are a 13-character policy plus a 2-digit term
 * counter; the older 12-character numbers have no such structure.
 */
export function policyBase(policyNumber: string): string | null {
  return policyNumber.length === 15 ? policyNumber.slice(0, 13) : null;
}

export interface Workbook {
  policies: Row[];
  claims: Row[];
}

export async function readWorkbook(file: string): Promise<Workbook> {
  // cellDates off: dates stay Excel serials and are converted without any
  // timezone (columns.ts), instead of becoming local-midnight Date objects.
  const wb = XLSX.read(await Bun.file(file).arrayBuffer(), {
    cellDates: false,
  });

  // A policy with several insured locations has several rows with the same
  // number and term; number them in file order (the extract dropped the
  // Location_No column FICOH's data dictionary describes).
  const seen = new Map<string, number>();
  const policies = parseSheet(
    sheetRows(wb, POLICY_SHEET),
    POLICY_SHEET,
    POLICY_COLUMNS,
  ).map(({ row, excelRow }) => {
    const key = `${row.policy_number}|${row.effective_date}`;
    const locationNo = (seen.get(key) ?? 0) + 1;
    seen.set(key, locationNo);
    return {
      id: excelRow,
      policy_base: policyBase(String(row.policy_number)),
      location_no: locationNo,
      ...row,
    };
  });

  const claims = parseSheet(
    sheetRows(wb, CLAIM_SHEET),
    CLAIM_SHEET,
    CLAIM_COLUMNS,
    CLAIM_IGNORED,
  ).map(({ row }) => row);
  return { policies, claims };
}

// ---------------------------------------------------------------------------
// Geocoding by address
// ---------------------------------------------------------------------------

export type TmkMatch = "unit" | "address" | "fuzzy";
export type GeocodeOutcome =
  TmkMatch | "ambiguous" | "not_found" | "no_address";

export interface AddressHit {
  tmk: string;
  match: TmkMatch;
  address: string;
}

/**
 * Reduce FICOH's address field to the street address: drop a trailing "HI"
 * and the city ("1942 KILOLANI PLACE HONOLULU HI"), and skip a leading
 * building name ("MAKAHA VALLEY TOWERS #1303 84-680 KILI DRIVE" → from
 * "84-680"; a number after "#" is a unit, not the house number).
 */
export function stripCity(address: string, city: string | null): string {
  let a = address
    .trim()
    .replace(/,?\s+HI$/i, "")
    .replace(/,$/, "");
  for (const c of (city ?? "").split(",").map((s) => s.trim()))
    if (c && a.toUpperCase().endsWith(" " + c.toUpperCase()))
      a = a.slice(0, a.length - c.length - 1).trimEnd();
  if (!/^\d/.test(a)) {
    const start =
      /(?:^|\s)(?<!#\s?)(\d{1,2}[- ]\d{1,4}|\d+[a-z]?)\s+[a-z]/i.exec(a);
    if (start) a = a.slice(start.index).trim();
  }
  return a.replace(/,\s*$/, "");
}

type Result = { hit: AddressHit | null; outcome: GeocodeOutcome };

/**
 * Narrow same-address parcels by the lot letter: "632 B HUNALEWA" is the
 * parcel whose own address carries B, and a plain "632 HUNALEWA" the one
 * that carries none.
 */
function byLot(parcels: Map<string, string>, lot: string | undefined) {
  if (parcels.size < 2) return parcels;
  return new Map(
    [...parcels].filter(([, addr]) => normalizeAddress(addr)?.lot === lot),
  );
}

/**
 * The parcel carrying this address in the ZIP's county, best evidence first:
 *   unit     the unit matches a condo unit's own qPublic address → its
 *            CPR-level TMK (the only match that is not CPR 0000)
 *   address  exact number + street on exactly one parcel (after the lot
 *            letter, when several parcels share the number)
 *   fuzzy    same number, street spelled slightly differently; known county
 *            only
 * Two or more equally good parcels is "ambiguous": no TMK.
 */
export function geocodeAddress(
  address: string | null,
  city: string | null,
  zip: string | null,
  addresses: AddressIndex,
): Result {
  const key = address ? normalizeAddress(stripCity(address, city)) : null;
  if (!key) return { hit: null, outcome: "no_address" };
  const county = zipCounty(zip);
  const inCounty = (tmk: string) => !county || tmk[0] === county;
  const only = (m: Iterable<[string, string]>) =>
    new Map([...m].filter(([tmk]) => inCounty(tmk)));

  const units = only(addresses.unitTmks(key) ?? []);
  if (units.size === 1) {
    const [[tmk, addr]] = units;
    return { hit: { tmk, match: "unit", address: addr }, outcome: "unit" };
  }

  const streets = addresses.streetsWithNumber(key.num);
  if (!streets) return { hit: null, outcome: "not_found" };
  const pick = (
    parcels: Map<string, string>,
    match: TmkMatch,
  ): Result | null => {
    const inScope = byLot(only(parcels), key.lot);
    if (inScope.size === 1) {
      const [[tmk, addr]] = inScope;
      return { hit: { tmk, match, address: addr }, outcome: match };
    }
    return only(parcels).size > 1 ? { hit: null, outcome: "ambiguous" } : null;
  };

  const exact = streets.get(key.street);
  const exactResult = exact && pick(exact, "address");
  if (exactResult) return exactResult;

  if (!county) return { hit: null, outcome: "not_found" };
  const similar = new Map<string, string>();
  for (const [street, parcels] of streets)
    if (
      street !== key.street &&
      streetSimilarity(key.street, street) >= FUZZY_MIN
    )
      for (const [tmk, addr] of parcels) similar.set(tmk, addr);
  return pick(similar, "fuzzy") ?? { hit: null, outcome: "not_found" };
}

export type GeocodeCounts = Record<GeocodeOutcome, number>;

function geocodeAll(
  rows: Row[],
  cols: { address: string; city: string; zip: string },
  addresses: AddressIndex,
): GeocodeCounts {
  const counts: GeocodeCounts = {
    unit: 0,
    address: 0,
    fuzzy: 0,
    ambiguous: 0,
    not_found: 0,
    no_address: 0,
  };
  // Policies repeat the same address every term; geocode each once.
  const cache = new Map<string, ReturnType<typeof geocodeAddress>>();
  for (const row of rows) {
    const [a, c, z] = [row[cols.address], row[cols.city], row[cols.zip]] as (
      string | null
    )[];
    const k = `${a}|${c}|${z}`;
    let r = cache.get(k);
    if (!r) cache.set(k, (r = geocodeAddress(a, c, z, addresses)));
    row.tmk = r.hit?.tmk ?? null;
    row.tmk_match = r.hit?.match ?? null;
    row.tmk_address = r.hit?.address ?? null;
    counts[r.outcome]++;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Claims → policy rows
// ---------------------------------------------------------------------------

export type PolicyMatch = "term" | "term_address" | "base" | "base_address";
export type LinkCounts = Record<PolicyMatch | "ambiguous" | "none", number>;

/**
 * The policy row in force on the date of loss: same policy number (else the
 * same 13-character base — the claim's term is sometimes missing from the
 * policy sheet), effective_date ≤ loss < expiration_date. A policy with
 * several locations is narrowed by the loss address.
 */
export function linkClaims(policies: Row[], claims: Row[]): LinkCounts {
  const byNumber = new Map<string, Row[]>();
  const byBase = new Map<string, Row[]>();
  for (const p of policies) {
    const n = String(p.policy_number);
    (byNumber.get(n) ?? byNumber.set(n, []).get(n)!).push(p);
    const b = p.policy_base as string | null;
    if (b) (byBase.get(b) ?? byBase.set(b, []).get(b)!).push(p);
  }
  const addrKey = (a: SqlValue, city: SqlValue) => {
    const k = a
      ? normalizeAddress(stripCity(String(a), city as string | null))
      : null;
    return k ? `${k.num}|${k.street}` : null;
  };

  const counts: LinkCounts = {
    term: 0,
    term_address: 0,
    base: 0,
    base_address: 0,
    ambiguous: 0,
    none: 0,
  };
  for (const c of claims) {
    const loss = String(c.date_of_loss);
    const inForce = (rows: Row[] | undefined) =>
      (rows ?? []).filter(
        (p) =>
          String(p.effective_date) <= loss && loss < String(p.expiration_date),
      );
    let via: "term" | "base" = "term";
    let rows = inForce(byNumber.get(String(c.policy_number)));
    if (!rows.length) {
      const base = policyBase(String(c.policy_number));
      rows = base ? inForce(byBase.get(base)) : [];
      via = "base";
    }
    let chosen: Row | null = null;
    let match: PolicyMatch | "ambiguous" | "none" = "none";
    if (rows.length === 1) {
      chosen = rows[0];
      match = via;
    } else if (rows.length > 1) {
      const key = addrKey(c.loss_address, c.loss_city);
      const same = key
        ? rows.filter((p) => addrKey(p.address, p.city) === key)
        : [];
      if (same.length === 1) {
        chosen = same[0];
        match = via === "term" ? "term_address" : "base_address";
      } else match = "ambiguous";
    }
    c.policy_id = chosen ? (chosen.id as number) : null;
    c.policy_match = match === "ambiguous" || match === "none" ? null : match;
    counts[match]++;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const quote = (c: string) => `\`${c}\``;

export function insertSql(
  table: string,
  columns: string[],
  rows: number,
): string {
  const ph = `(${columns.map(() => "?").join(", ")})`;
  return (
    `INSERT INTO ${table} (${columns.map(quote).join(", ")}) VALUES ` +
    Array(rows).fill(ph).join(", ")
  );
}

async function insertAll(
  query: Db,
  table: string,
  columns: string[],
  rows: Row[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
    const chunk = rows.slice(i, i + CHUNK_ROWS);
    await query(
      insertSql(table, columns, chunk.length),
      chunk.flatMap((r) => columns.map((c) => r[c] ?? null)),
    );
  }
}

export interface FicohOptions {
  file?: string;
  /** Parse, geocode and link; write nothing. */
  dryRun?: boolean;
  /** Write to the local rebuild DB instead of the remote housing DB. */
  local?: boolean;
  /** Prebuilt address index (tests); otherwise read from properties. */
  addressIndex?: AddressIndex;
  db?: Db;
  tx?: Tx;
}

export async function load(opts: FicohOptions = {}) {
  const file =
    opts.file?.trim() || process.env.FICOH_FILE?.trim() || DEFAULT_FICOH_FILE;
  const db = opts.db ?? (opts.local ? (localRawQuery as Db) : (rawQuery as Db));
  const tx: Tx =
    opts.tx ??
    ((fn) => (opts.local ? localTransaction : transaction)((q) => fn(q as Db)));

  const start = performance.now();
  const bytes = statSync(file).size;
  const { policies, claims } = await readWorkbook(file);
  log.info({ policies: policies.length, claims: claims.length }, "parsed");

  const addresses = opts.addressIndex ?? (await AddressIndex.fromDb(db));
  const policyGeo = geocodeAll(
    policies,
    { address: "address", city: "city", zip: "zip" },
    addresses,
  );
  const claimGeo = geocodeAll(
    claims,
    { address: "loss_address", city: "loss_city", zip: "loss_zip" },
    addresses,
  );
  const links = linkClaims(policies, claims);

  if (!opts.dryRun) {
    await tx(async (query) => {
      await query("DELETE FROM insurance_claims");
      await query("DELETE FROM insurance_policies");
      await insertAll(
        query,
        "insurance_policies",
        POLICY_INSERT_COLUMNS,
        policies,
      );
      await insertAll(query, "insurance_claims", CLAIM_INSERT_COLUMNS, claims);
      await query(
        `INSERT INTO insurance_loads (file_name, file_bytes, policies, claims,
           policies_geocoded, claims_geocoded, claims_linked, loaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          path.basename(file),
          bytes,
          policies.length,
          claims.length,
          policyGeo.unit + policyGeo.address + policyGeo.fuzzy,
          claimGeo.unit + claimGeo.address + claimGeo.fuzzy,
          claims.length - links.ambiguous - links.none,
          toHstSql(new Date()).slice(0, 19),
        ],
      );
    });
  }

  // The Summary / Exploration counts must match what was just loaded.
  const freq = opts.dryRun
    ? null
    : await refreshFreqTables(db, tx, [
        { table: "insurance_policies", dateColumns: FICOH_DATE_COLUMNS },
        { table: "insurance_claims", dateColumns: FICOH_DATE_COLUMNS },
      ]);

  return {
    target: opts.dryRun ? "none (dry run)" : opts.local ? "local" : "remote",
    file,
    freq,
    policies: policies.length,
    claims: claims.length,
    policyGeocode: policyGeo,
    claimGeocode: claimGeo,
    claimLinks: links,
    ms: Math.round(performance.now() - start),
  };
}
