/**
 * DCCA condo register → condominium_projects, in three rerunnable stages:
 *
 *   list      fetch the index page (cached per day), parse every project link,
 *             write runs/{date}-list.json
 *   profiles  fetch each profile page not yet cached (or all, --refetch);
 *             dated snapshots under profiles/{reg}/
 *   load      parse the latest cached snapshot of every profile, match it to a
 *             condominium_projects row, write the register fields, and write
 *             runs/{date}-report.csv with one line per profile
 *
 * `run` is the three in order. Each stage is safe to repeat: the fetch stages
 * skip what is cached, and the load stage rewrites the same values.
 */

import { hstToday } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";

import {
  cachedRegs,
  dccaCacheRoot,
  indexPath,
  latestProfileSnapshot,
  listJsonPath,
  profilePath,
  readText,
  reportCsvPath,
  writeText,
} from "./cache";
import {
  DCCA_INDEX_URL,
  DCCA_MIN_INDEX_BYTES,
  DCCA_MIN_PROFILE_BYTES,
  dccaProfileUrl,
} from "./config";
import { createFetcher, DccaFetchAbort, DccaFetchError } from "./fetch";
import type { Fetcher } from "./fetch";
import {
  filterExistingProperties,
  getCondoCandidates,
  insertProject,
  selectDb,
  updateProject,
} from "./load";
import type { Db } from "./load";
import { indexCandidates, matchProfile, preferProfile } from "./match";
import type { MatchResult } from "./match";
import { parseList } from "./parse-list";
import { parseProfile } from "./parse-profile";
import { DccaParseError } from "./types";
import type { DccaListEntry, DccaProfile } from "./types";

const log = createLogger("dcca-pipeline");

export interface DccaRunOptions {
  /** Ignore cached copies and fetch again (still writes through). */
  refetch?: boolean;
  /** Parse and match, write nothing to the database. */
  dryRun?: boolean;
  /** Stop after this many profile fetches / loads (smoke tests). */
  max?: number;
  /** Write to the local rebuild DB instead of the remote housing DB. */
  local?: boolean;
  /**
   * When a profile's TMK is a real parcel with no condominium_projects row,
   * insert one (name and unit count from the register). Off by default:
   * the register's TMK is sometimes wrong and a bad row is worse than a gap.
   */
  insertNew?: boolean;
  /** Override the run date (YYYY-MM-DD, HST). Default today. */
  date?: string;
  /** Test seams. */
  fetcher?: Fetcher;
  db?: Db;
  shouldStop?: () => boolean;
}

export class DccaRunInterrupted extends Error {
  constructor() {
    super("DCCA run interrupted");
    this.name = "DccaRunInterrupted";
  }
}

function setup(opts: DccaRunOptions) {
  const { root, onNas } = dccaCacheRoot();
  const date = opts.date ?? hstToday();
  if (!onNas) {
    log.warn({ root }, "NAS not mounted — caching DCCA pages in a temp dir");
  }
  return { root, date };
}

// ─── list ────────────────────────────────────────────────────────────────

export interface ListSummary {
  date: string;
  root: string;
  fromCache: boolean;
  projects: number;
  listFile: string;
}

export async function list(opts: DccaRunOptions = {}): Promise<ListSummary> {
  const { root, date } = setup(opts);
  const file = indexPath(root, date);
  let html = opts.refetch ? null : await readText(file);
  const fromCache = html !== null;
  if (html === null) {
    const fetcher = opts.fetcher ?? createFetcher();
    log.info({ url: DCCA_INDEX_URL }, "fetching DCCA index");
    html = await fetcher.get(DCCA_INDEX_URL, DCCA_MIN_INDEX_BYTES);
    await writeText(file, html);
  }
  const entries = parseList(html);
  const listFile = listJsonPath(root, date);
  await writeText(listFile, JSON.stringify(entries, null, 2));
  log.info(
    { projects: entries.length, fromCache, listFile },
    "DCCA index parsed",
  );
  return { date, root, fromCache, projects: entries.length, listFile };
}

async function loadListEntries(
  root: string,
  date: string,
): Promise<DccaListEntry[]> {
  const text = await readText(listJsonPath(root, date));
  if (text) return JSON.parse(text) as DccaListEntry[];
  // No list for this date: fall back to the newest list file, else to what is cached.
  const regs = await cachedRegs(root);
  return regs.map((reg) => ({
    reg,
    name: "",
    addressLine: null,
    url: dccaProfileUrl(reg),
  }));
}

// ─── profiles ────────────────────────────────────────────────────────────

export interface ProfilesSummary {
  date: string;
  wanted: number;
  fetched: number;
  cached: number;
  failed: number;
  notFound: number;
  requests: number;
  retries: number;
}

export async function profiles(
  opts: DccaRunOptions = {},
): Promise<ProfilesSummary> {
  const { root, date } = setup(opts);
  let entries = await loadListEntries(root, date);
  if (entries.length === 0) {
    const l = await list(opts);
    entries = JSON.parse(
      (await readText(l.listFile)) ?? "[]",
    ) as DccaListEntry[];
  }
  const fetcher = opts.fetcher ?? createFetcher();
  const summary: ProfilesSummary = {
    date,
    wanted: entries.length,
    fetched: 0,
    cached: 0,
    failed: 0,
    notFound: 0,
    requests: 0,
    retries: 0,
  };

  for (const entry of entries) {
    if (opts.shouldStop?.()) throw new DccaRunInterrupted();
    if (opts.max != null && summary.fetched >= opts.max) break;
    if (!opts.refetch && (await latestProfileSnapshot(root, entry.reg))) {
      summary.cached++;
      continue;
    }
    try {
      const html = await fetcher.get(entry.url, DCCA_MIN_PROFILE_BYTES);
      await writeText(profilePath(root, entry.reg, date), html);
      summary.fetched++;
      if (parseProfile(html, entry.reg) === null) summary.notFound++;
      if (summary.fetched % 250 === 0) {
        log.info({ ...summary, ...fetcher.stats() }, "DCCA profiles progress");
      }
    } catch (err) {
      if (err instanceof DccaFetchAbort) throw err;
      if (err instanceof DccaFetchError || err instanceof DccaParseError) {
        summary.failed++;
        log.warn({ reg: entry.reg, err: err.message }, "DCCA profile failed");
        continue;
      }
      throw err;
    }
  }
  Object.assign(summary, fetcher.stats());
  log.info({ ...summary }, "DCCA profiles done");
  return summary;
}

// ─── load ────────────────────────────────────────────────────────────────

export interface LoadSummary {
  date: string;
  dryRun: boolean;
  target: "remote" | "local";
  profiles: number;
  parseErrors: number;
  notFound: number;
  matchedByTmk: number;
  matchedByName: number;
  unmatched: number;
  ambiguous: number;
  noTmk: number;
  /** Profiles that lost a row to a better-ranked profile. */
  superseded: number;
  /** Unmatched profiles whose TMK is a real parcel with no condo row. */
  insertable: number;
  updated: number;
  inserted: number;
  reportFile: string;
  /** Labels seen on profile pages that the parser does not know. */
  unknownLabels: string[];
}

type Outcome =
  | "updated"
  | "inserted"
  | "would-update"
  | "would-insert"
  | "superseded"
  | "unmatched"
  | "ambiguous"
  | "no-tmk"
  | "insertable"
  | "not-found"
  | "parse-error";

interface ReportRow {
  reg: string;
  name: string;
  tmkRaw: string;
  tmk: string;
  totalUnits: string;
  outcome: Outcome;
  matchedBy: "tmk" | "name" | "";
  matchedTmk: string;
  matchedName: string;
  matchedUnits: string;
  note: string;
}

const REPORT_HEADER: (keyof ReportRow)[] = [
  "reg",
  "name",
  "tmkRaw",
  "tmk",
  "totalUnits",
  "outcome",
  "matchedBy",
  "matchedTmk",
  "matchedName",
  "matchedUnits",
  "note",
];

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: ReportRow[]): string {
  const lines = [REPORT_HEADER.join(",")];
  for (const r of rows)
    lines.push(REPORT_HEADER.map((k) => csvCell(r[k])).join(","));
  return lines.join("\n") + "\n";
}

function reportRow(
  p: Pick<DccaProfile, "reg" | "name" | "tmkRaw" | "tmk" | "totalUnits">,
  outcome: Outcome,
  match?: MatchResult,
  note = "",
): ReportRow {
  const c = match && match.kind !== "none" ? match.candidate : null;
  return {
    reg: p.reg,
    name: p.name,
    tmkRaw: p.tmkRaw ?? "",
    tmk: p.tmk ?? "",
    totalUnits: p.totalUnits == null ? "" : String(p.totalUnits),
    outcome,
    matchedBy: match && match.kind !== "none" ? match.kind : "",
    matchedTmk: c?.tmk ?? "",
    matchedName: c?.projectName ?? "",
    matchedUnits: c?.unitCount == null ? "" : String(c.unitCount),
    note,
  };
}

export async function load(opts: DccaRunOptions = {}): Promise<LoadSummary> {
  const { root, date } = setup(opts);
  const db = opts.db ?? selectDb(Boolean(opts.local));
  const dryRun = Boolean(opts.dryRun);
  const regs = await cachedRegs(root);
  const summary: LoadSummary = {
    date,
    dryRun,
    target: opts.local ? "local" : "remote",
    profiles: 0,
    parseErrors: 0,
    notFound: 0,
    matchedByTmk: 0,
    matchedByName: 0,
    unmatched: 0,
    ambiguous: 0,
    noTmk: 0,
    superseded: 0,
    insertable: 0,
    updated: 0,
    inserted: 0,
    reportFile: reportCsvPath(root, date),
    unknownLabels: [],
  };
  const report: ReportRow[] = [];
  const unknownLabels = new Set<string>();

  // 1. Parse every cached profile (latest snapshot).
  const parsed: DccaProfile[] = [];
  for (const reg of regs) {
    if (opts.max != null && parsed.length >= opts.max) break;
    const snap = await latestProfileSnapshot(root, reg);
    if (!snap) continue;
    const html = (await readText(snap.file)) ?? "";
    summary.profiles++;
    try {
      const p = parseProfile(html, reg);
      if (p === null) {
        summary.notFound++;
        report.push(
          reportRow(
            { reg, name: "", tmkRaw: null, tmk: null, totalUnits: null },
            "not-found",
          ),
        );
        continue;
      }
      for (const k of Object.keys(p.extra)) unknownLabels.add(k);
      parsed.push(p);
    } catch (err) {
      if (!(err instanceof DccaParseError)) throw err;
      summary.parseErrors++;
      report.push(
        reportRow(
          { reg, name: "", tmkRaw: null, tmk: null, totalUnits: null },
          "parse-error",
          undefined,
          err.message,
        ),
      );
    }
  }
  summary.unknownLabels = [...unknownLabels].sort();
  if (unknownLabels.size) {
    log.warn(
      { labels: summary.unknownLabels },
      "DCCA profiles carry labels the parser does not know",
    );
  }

  // 2. Match against the current condo rows.
  const index = indexCandidates(await getCondoCandidates(db));
  const claims = new Map<
    string,
    { profile: DccaProfile; match: MatchResult }[]
  >();
  const unmatched: { profile: DccaProfile; match: MatchResult }[] = [];
  for (const profile of parsed) {
    const match = matchProfile(profile, index);
    if (match.kind === "none") {
      unmatched.push({ profile, match });
      continue;
    }
    const list = claims.get(match.candidate.tmk) ?? [];
    list.push({ profile, match });
    claims.set(match.candidate.tmk, list);
  }

  // 3. Resolve rows claimed by several profiles, then write.
  for (const [tmk, claimants] of claims) {
    claimants.sort(preferProfile);
    const [winner, ...losers] = claimants;
    for (const l of losers) {
      summary.superseded++;
      report.push(
        reportRow(
          l.profile,
          "superseded",
          l.match,
          `row taken by reg ${winner.profile.reg}`,
        ),
      );
    }
    const m = winner.match;
    if (m.kind === "tmk") summary.matchedByTmk++;
    else summary.matchedByName++;
    const note =
      m.kind === "tmk" && !m.nameAgrees
        ? "name differs"
        : m.kind === "name"
          ? `register TMK ${winner.profile.tmkRaw ?? "(none)"} is not this row`
          : "";
    if (dryRun) {
      report.push(reportRow(winner.profile, "would-update", m, note));
    } else {
      await updateProject(db, tmk, winner.profile);
      summary.updated++;
      report.push(reportRow(winner.profile, "updated", m, note));
    }
  }

  // 4. Unmatched: is the register's TMK at least a real parcel?
  const candidateTmks = unmatched
    .filter(
      (u) =>
        u.match.kind === "none" &&
        u.match.reason === "unmatched" &&
        u.profile.tmk,
    )
    .map((u) => u.profile.tmk as string);
  const realParcels = candidateTmks.length
    ? await filterExistingProperties(db, candidateTmks)
    : new Set<string>();
  const insertedTmks = new Set<string>();
  for (const { profile, match } of unmatched) {
    if (match.kind !== "none") continue;
    if (match.reason === "no-tmk") {
      summary.noTmk++;
      report.push(
        reportRow(
          profile,
          "no-tmk",
          undefined,
          `TMK "${profile.tmkRaw ?? ""}" is not 9 digits`,
        ),
      );
    } else if (match.reason === "ambiguous") {
      summary.ambiguous++;
      const names = (match.candidates ?? []).map((c) => c.tmk).join(" | ");
      report.push(
        reportRow(profile, "ambiguous", undefined, `name fits: ${names}`),
      );
    } else if (
      profile.tmk &&
      realParcels.has(profile.tmk) &&
      !insertedTmks.has(profile.tmk)
    ) {
      summary.insertable++;
      if (opts.insertNew && !dryRun) {
        await insertProject(db, profile.tmk, profile);
        insertedTmks.add(profile.tmk);
        summary.inserted++;
        report.push(
          reportRow(
            profile,
            "inserted",
            undefined,
            "parcel exists, condo row created",
          ),
        );
      } else {
        report.push(
          reportRow(
            profile,
            opts.insertNew ? "would-insert" : "insertable",
            undefined,
            "parcel exists, no condo row",
          ),
        );
      }
    } else {
      summary.unmatched++;
      report.push(
        reportRow(
          profile,
          "unmatched",
          undefined,
          "no condo row at TMK, no unique name match",
        ),
      );
    }
  }

  report.sort((a, b) => Number(a.reg) - Number(b.reg));
  await writeText(summary.reportFile, toCsv(report));
  log.info({ ...summary }, "DCCA load done");
  return summary;
}

// ─── run ─────────────────────────────────────────────────────────────────

export async function run(opts: DccaRunOptions = {}) {
  const listed = await list(opts);
  const fetched = await profiles(opts);
  const loaded = await load(opts);
  return { list: listed, profiles: fetched, load: loaded };
}
