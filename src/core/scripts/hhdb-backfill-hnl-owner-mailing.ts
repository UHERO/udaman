/**
 * Backfill owners.mailing_* (and a synthesized owner_address) for Honolulu
 * from the city's own OWNERDAT tax-bill extract.
 *
 * qPublic's Honolulu template renders no owner/mailing address at all (see
 * county-gaps.md), so owners.owner_address is NULL for every county-1 row.
 * OWNERDAT gives one tax-bill address per *parcel*, but owners can have
 * several co-owner rows per tmk with genuinely different addresses (see
 * counties 2-4) — the file doesn't say which owner it belongs to, so this
 * matches the tax-bill name (taxbillowner, falling back to own2) against
 * the specific owner row it names, by normalized token overlap, and only
 * writes that one row. Co-owner rows that don't match stay untouched.
 *
 * Join key: OWNERDAT's `parid` (12 digits, no county digit) is identical to
 * `tmk` with its leading county segment dropped and the rest concatenated
 * without dashes — verified against every Honolulu tmk with a populated
 * parcel_number. parcel_number itself isn't used as the join key because
 * it's NULL for ~47% of Honolulu properties; deriving from tmk directly
 * gets full coverage.
 *
 * Usage:
 *   bun run src/core/scripts/hhdb-backfill-hnl-owner-mailing.ts               # dry run
 *   bun run src/core/scripts/hhdb-backfill-hnl-owner-mailing.ts --execute     # write
 *   bun run src/core/scripts/hhdb-backfill-hnl-owner-mailing.ts --file <path>
 */
import { rawQuery } from "@/lib/mysql/hhdb";

const DEFAULT_FILE =
  "/Volumes/UHEROroot/work/data/hawaii housing database/HNL-OWNERDAT-2025-08-29.csv";

const EXECUTE = process.argv.includes("--execute");
const fileArgIdx = process.argv.indexOf("--file");
const FILE_PATH =
  fileArgIdx >= 0 && process.argv[fileArgIdx + 1]
    ? process.argv[fileArgIdx + 1]
    : DEFAULT_FILE;

const MATCH_THRESHOLD = 0.6;
const CONCURRENCY = 20;

// ─── Minimal RFC4180 CSV parser (quoted fields, embedded commas/quotes) ────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type OwnerDatRow = {
  parid: string;
  taxbillowner: string;
  own2: string;
  taxbilladdress: string;
  taxbillcity: string;
  taxbillstate: string;
  taxbillcountry: string;
  taxbillzip5: string;
  taxbillzip4: string;
  addrnum: string;
  addrdir: string;
  addrstreet: string;
  addrtype: string;
  addrunit: string;
  unitdesc: string;
};

function parseOwnerDat(text: string): OwnerDatRow[] {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const cols = {
    parid: idx("parid"),
    taxbillowner: idx("taxbillowner"),
    own2: idx("own2"),
    taxbilladdress: idx("taxbilladdress"),
    taxbillcity: idx("taxbillcity"),
    taxbillstate: idx("taxbillstate"),
    taxbillcountry: idx("taxbillcountry"),
    taxbillzip5: idx("taxbillzip5"),
    taxbillzip4: idx("taxbillzip4"),
    addrnum: idx("addrnum"),
    addrdir: idx("addrdir"),
    addrstreet: idx("addrstreet"),
    addrtype: idx("addrtype"),
    addrunit: idx("addrunit"),
    unitdesc: idx("unitdesc"),
  };

  const out: OwnerDatRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    out.push({
      parid: get(cols.parid),
      taxbillowner: get(cols.taxbillowner),
      own2: get(cols.own2),
      taxbilladdress: get(cols.taxbilladdress),
      taxbillcity: get(cols.taxbillcity),
      taxbillstate: get(cols.taxbillstate),
      taxbillcountry: get(cols.taxbillcountry),
      taxbillzip5: get(cols.taxbillzip5),
      taxbillzip4: get(cols.taxbillzip4),
      addrnum: get(cols.addrnum),
      addrdir: get(cols.addrdir),
      addrstreet: get(cols.addrstreet),
      addrtype: get(cols.addrtype),
      addrunit: get(cols.addrunit),
      unitdesc: get(cols.unitdesc),
    });
  }
  return out;
}

// ─── Name normalization / matching ─────────────────────────────────────────

const NOISE = new Set([
  "TR",
  "TRS",
  "TRUST",
  "TRUSTEE",
  "TRUSTEES",
  "EST",
  "ESTATE",
  "LLC",
  "LLLP",
  "LP",
  "INC",
  "CO",
  "LTD",
  "REVOCABLE",
  "LIVING",
  "FAMILY",
  "THE",
  "OF",
  "AND",
  "DECD",
]);

function normalize(name: string): string {
  if (!name) return "";
  let n = name.toUpperCase();
  n = n.replace(/['.]/g, "");
  n = n.replace(/[^A-Z0-9,& /]/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

function tokenSet(name: string): Set<string> {
  const n = normalize(name).replace(/[,&/]/g, " ");
  const toks = n.split(" ").filter((t) => t.length > 1 || /^\d+$/.test(t));
  return new Set(toks.filter((t) => !NOISE.has(t)));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.min(a.size, b.size);
}

// ─── Address assembly ───────────────────────────────────────────────────────

function buildStreetAddress(row: OwnerDatRow): string | null {
  let street = row.taxbilladdress;
  if (!street) {
    street = [row.addrnum, row.addrdir, row.addrstreet, row.addrtype]
      .filter(Boolean)
      .join(" ");
  }
  if (row.addrunit) {
    const label = row.unitdesc || "UNIT";
    street = street ? `${street} ${label} ${row.addrunit}` : `${label} ${row.addrunit}`;
  }
  return street.trim() || null;
}

function buildZip(row: OwnerDatRow): string | null {
  if (!row.taxbillzip5) return null;
  return row.taxbillzip4 ? `${row.taxbillzip5}-${row.taxbillzip4}` : row.taxbillzip5;
}

function synthesizeOwnerAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
  country: string | null,
): string | null {
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" ");
  const parts = [street, cityStateZip || null, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ─── DB row types ───────────────────────────────────────────────────────────

type DbOwnerRow = {
  id: number;
  tmk: string;
  owner_name: string;
  sequence_order: number | null;
};

/** tmk "1-1-1-002-002-0000" -> "110020020000" (drop county segment, keep the rest as-is). */
function tmkToParid(tmk: string): string {
  return tmk.split("-").slice(1).join("");
}

type PlannedUpdate = {
  ownerId: number;
  tmk: string;
  matchedName: string;
  matchedVia: "taxbillowner" | "own2";
  overlap: number;
  isFirstOwner: boolean;
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  mailingCountry: string | null;
  ownerAddress: string | null;
};

async function main() {
  console.log(`=== HNL owner mailing-address backfill (${EXECUTE ? "EXECUTE" : "DRY RUN"}) ===`);
  console.log(`File: ${FILE_PATH}\n`);

  const text = await Bun.file(FILE_PATH).text();
  const csvRows = parseOwnerDat(text);
  console.log(`Parsed ${csvRows.length} OWNERDAT rows`);

  const dbRows = await rawQuery<DbOwnerRow>(
    `SELECT id, tmk, owner_name, sequence_order FROM owners WHERE tmk LIKE '1-%'`,
  );
  console.log(`Loaded ${dbRows.length} Honolulu owner rows from hhdb\n`);

  const ownersByKey = new Map<string, DbOwnerRow[]>();
  for (const r of dbRows) {
    const key = tmkToParid(r.tmk);
    let list = ownersByKey.get(key);
    if (!list) {
      list = [];
      ownersByKey.set(key, list);
    }
    list.push(r);
  }

  let noPropertyMatch = 0;
  let matchedFirst = 0;
  let matchedNonFirst = 0;
  let matchedViaOwn2 = 0;
  let noNameMatch = 0;

  const updates: PlannedUpdate[] = [];
  const unmatchedSamples: Array<{ parid: string; taxbillowner: string; own2: string; candidates: string[] }> = [];
  const nonFirstSamples: Array<{ parid: string; matchedName: string; candidates: string[] }> = [];

  for (const row of csvRows) {
    const owners = ownersByKey.get(row.parid);
    if (!owners || owners.length === 0) {
      noPropertyMatch++;
      continue;
    }

    // Names that reduce entirely to noise/single-letter words (e.g. "FAMILY
    // TR", "K AND H TR", "I M C INC") produce empty token sets on both
    // sides, so token overlap alone can never fire even on an exact string
    // match — check literal normalized equality first as an unambiguous
    // match, then fall back to fuzzy token overlap.
    function findBestMatch(candidateName: string): { owner: DbOwnerRow; overlap: number } | null {
      const norm = normalize(candidateName);
      if (norm) {
        const exact = owners!.find((o) => normalize(o.owner_name) === norm);
        if (exact) return { owner: exact, overlap: 1 };
      }
      const tokens = tokenSet(candidateName);
      let best: { owner: DbOwnerRow; overlap: number } | null = null;
      for (const owner of owners!) {
        const score = overlapScore(tokenSet(owner.owner_name), tokens);
        if (
          score >= MATCH_THRESHOLD &&
          (!best ||
            score > best.overlap ||
            (score === best.overlap &&
              (owner.sequence_order ?? Infinity) < (best.owner.sequence_order ?? Infinity)))
        ) {
          best = { owner, overlap: score };
        }
      }
      return best;
    }

    let best: { owner: DbOwnerRow; overlap: number; via: "taxbillowner" | "own2" } | null = null;
    const tbMatch = findBestMatch(row.taxbillowner);
    if (tbMatch) best = { ...tbMatch, via: "taxbillowner" };
    if (!best && row.own2) {
      const own2Match = findBestMatch(row.own2);
      if (own2Match) best = { ...own2Match, via: "own2" };
    }

    if (!best) {
      noNameMatch++;
      if (unmatchedSamples.length < 20) {
        unmatchedSamples.push({
          parid: row.parid,
          taxbillowner: row.taxbillowner,
          own2: row.own2,
          candidates: owners.map((o) => o.owner_name),
        });
      }
      continue;
    }

    if (best.via === "own2") matchedViaOwn2++;

    const minSeq = Math.min(...owners.map((o) => o.sequence_order ?? Infinity));
    const isFirstOwner = (best.owner.sequence_order ?? Infinity) === minSeq;
    if (isFirstOwner) {
      matchedFirst++;
    } else {
      matchedNonFirst++;
      if (nonFirstSamples.length < 15) {
        nonFirstSamples.push({
          parid: row.parid,
          matchedName: best.owner.owner_name,
          candidates: owners.map((o) => o.owner_name),
        });
      }
    }

    const street = buildStreetAddress(row);
    const city = row.taxbillcity || null;
    const state = row.taxbillstate || null;
    const zip = buildZip(row);
    const country = row.taxbillcountry || null;
    const ownerAddress = synthesizeOwnerAddress(street, city, state, zip, country);

    updates.push({
      ownerId: best.owner.id,
      tmk: best.owner.tmk,
      matchedName: best.owner.owner_name,
      matchedVia: best.via,
      overlap: best.overlap,
      isFirstOwner,
      mailingAddress: street,
      mailingCity: city,
      mailingState: state,
      mailingZip: zip,
      mailingCountry: country,
      ownerAddress,
    });
  }

  console.log(`=== Match summary ===`);
  console.log(`Total OWNERDAT rows: ${csvRows.length}`);
  console.log(`No property/owner rows found for parid: ${noPropertyMatch}`);
  console.log(`Matched to first-listed owner: ${matchedFirst}`);
  console.log(`Matched to a non-first owner: ${matchedNonFirst} (via own2: ${matchedViaOwn2})`);
  console.log(`No name match among candidate owners: ${noNameMatch}`);
  const attempted = csvRows.length - noPropertyMatch;
  const matched = matchedFirst + matchedNonFirst;
  console.log(
    `Match rate: ${matched}/${attempted} (${((matched / attempted) * 100).toFixed(2)}%)\n`,
  );

  console.log(`=== Sample: matched a non-first owner ===`);
  for (const s of nonFirstSamples) {
    console.log(`  ${s.parid}: matched "${s.matchedName}" among [${s.candidates.join(" | ")}]`);
  }
  console.log(`\n=== Sample: no name match ===`);
  for (const s of unmatchedSamples) {
    console.log(
      `  ${s.parid}: taxbillowner="${s.taxbillowner}" own2="${s.own2}" candidates=[${s.candidates.join(" | ")}]`,
    );
  }

  if (!EXECUTE) {
    console.log(`\n${updates.length} owner rows would be updated. (dry run — pass --execute to write)`);
    process.exit(0);
  }

  console.log(`\nWriting ${updates.length} owner rows...`);
  let done = 0;
  let idx = 0;
  async function worker() {
    while (idx < updates.length) {
      const u = updates[idx++];
      await rawQuery(
        `UPDATE owners
         SET mailing_address = ?, mailing_city = ?, mailing_state = ?, mailing_zip = ?, mailing_country = ?, owner_address = ?
         WHERE id = ?`,
        [
          u.mailingAddress,
          u.mailingCity,
          u.mailingState,
          u.mailingZip,
          u.mailingCountry,
          u.ownerAddress,
          u.ownerId,
        ],
      );
      done++;
      if (done % 10000 === 0) {
        console.log(`  ${done}/${updates.length} written`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\nDone. ${done} owner rows updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
