/**
 * Decide which condominium_projects row a DCCA profile describes. Pure.
 *
 * The register's TMK is the primary key when the housing DB has a condo
 * project at that parcel. It is not always right (a lot number, a parent
 * parcel from before a subdivision, a typo), so the fallback is the project
 * name — normalized hard, because the two sources also disagree on spelling
 * ("'AINA MAUKA CONDOMINIUMS" vs "AINA MAUKA"), and restricted to the same
 * island when the TMK at least got the county digit right. A name that fits
 * several rows is broken by unit count and otherwise left unmatched: a wrong
 * row silently enriched is worse than a gap in the report.
 */

import { cleanText, tmkCounty } from "./text";
import type { DccaProfile } from "./types";

export interface CondoCandidate {
  tmk: string;
  projectName: string | null;
  unitCount: number | null;
}

export type MatchResult =
  | { kind: "tmk"; candidate: CondoCandidate; nameAgrees: boolean }
  | { kind: "name"; candidate: CondoCandidate; tmkAgrees: false }
  | {
      kind: "none";
      reason: "no-tmk" | "unmatched" | "ambiguous";
      /** Rows that share the normalized name (ambiguous only). */
      candidates?: CondoCandidate[];
    };

/** Words that carry no identity: what the thing is, not which one it is. */
const NOISE_WORDS = new Set([
  "THE",
  "A",
  "AN",
  "AND",
  "OF",
  "AT",
  "CONDOMINIUM",
  "CONDOMINIUMS",
  "CONDO",
  "CONDOS",
  "CPR",
  "PROJECT",
  "PROJECTS",
  "APARTMENTS",
  "APARTMENT",
  "APTS",
  "INC",
  "LLC",
  "LTD",
  "PHASE",
  "PH",
  "I",
  "II",
  "III",
  "IV",
]);

/**
 * Upper-case, drop the "(514B, HRS)"-style statute tags and the punctuation
 * both sources use inconsistently (quotes, okina, hyphens, ampersands),
 * strip noise words, collapse spaces.
 */
export function normalizeName(raw: string | null | undefined): string {
  const upper = cleanText(raw)
    .toUpperCase()
    .replace(/\((?:[^)]*\bHRS\b[^)]*|514[AB]?)\)/g, " ")
    .replace(/&/g, " AND ")
    .replace(/[‘’ʻ'"`.,#:;!?()[\]{}/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = upper.split(" ").filter((w) => w && !NOISE_WORDS.has(w));
  // A name made only of noise words ("The Condominium") keeps its raw words
  // rather than collapsing to "" and matching everything.
  return (words.length ? words : upper.split(" ")).join(" ");
}

export interface CandidateIndex {
  byTmk: Map<string, CondoCandidate>;
  byName: Map<string, CondoCandidate[]>;
}

export function indexCandidates(rows: CondoCandidate[]): CandidateIndex {
  const byTmk = new Map<string, CondoCandidate>();
  const byName = new Map<string, CondoCandidate[]>();
  for (const row of rows) {
    byTmk.set(row.tmk, row);
    const key = normalizeName(row.projectName);
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }
  return { byTmk, byName };
}

export function matchProfile(
  profile: DccaProfile,
  index: CandidateIndex,
): MatchResult {
  const nameKey = normalizeName(profile.name);

  if (profile.tmk) {
    const hit = index.byTmk.get(profile.tmk);
    if (hit) {
      return {
        kind: "tmk",
        candidate: hit,
        nameAgrees: normalizeName(hit.projectName) === nameKey,
      };
    }
  }

  let byName = nameKey ? (index.byName.get(nameKey) ?? []) : [];
  if (profile.tmk && byName.length > 1) {
    const county = tmkCounty(profile.tmk);
    const sameIsland = byName.filter((c) => tmkCounty(c.tmk) === county);
    if (sameIsland.length > 0) byName = sameIsland;
  }
  if (byName.length > 1 && profile.totalUnits != null) {
    const sameSize = byName.filter((c) => c.unitCount === profile.totalUnits);
    if (sameSize.length === 1) byName = sameSize;
  }

  if (byName.length === 1) {
    return { kind: "name", candidate: byName[0], tmkAgrees: false };
  }
  if (byName.length > 1) {
    return { kind: "none", reason: "ambiguous", candidates: byName };
  }
  return { kind: "none", reason: profile.tmk ? "unmatched" : "no-tmk" };
}

/**
 * Several profiles can claim one row (a re-registration, or a wrong TMK that
 * happens to be another project's). Rank: a TMK match beats a name match; a
 * matching name beats a differing one; then the newer (higher) registration.
 */
export function preferProfile(
  a: { profile: DccaProfile; match: MatchResult },
  b: { profile: DccaProfile; match: MatchResult },
): number {
  const score = (m: MatchResult) =>
    m.kind === "tmk" ? (m.nameAgrees ? 3 : 2) : m.kind === "name" ? 1 : 0;
  const d = score(b.match) - score(a.match);
  if (d !== 0) return d;
  return Number(b.profile.reg) - Number(a.profile.reg);
}
