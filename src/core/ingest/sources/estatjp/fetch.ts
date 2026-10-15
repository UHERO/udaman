/**
 * Acquire e-Stat series: one getStatsData request (all pages) per table
 * named by the load statements, narrowed to the union of the codes they
 * ask for (a classification some statement leaves open is not narrowed).
 * The response is split by series — every classification but time — and
 * each is stored as its own artifact, so the hash depends on the series
 * alone, not on the batch it rode in. The stored body leaves out the
 * response's fetch timestamp and the table's UPDATED_DATE (which moves
 * for every series on each release; it goes in the metadata).
 */

import {
  fetchStatsDataRaw,
  type EstatTable,
} from "@catalog/utils/api-clients/estat-jp";

import type { FetchContext } from "../../types";

const THROTTLE_MS = 500;
const ID_RE = /^\d{10}$/;
const CLASS_RE = /^(tab|area|cat(0[1-9]|1[0-5]))$/;

/** What one stored artifact holds: one series of one table. */
export type EstatSeriesFile = {
  statsDataId: string;
  title: string;
  /** classification id → this series' code (time excluded) */
  codes: Record<string, string>;
  /** classification id → { name of the classification, name of the code } */
  labels: Record<string, { class: string; code: string }>;
  unit: string | null;
  notes: Array<{ char: string; text: string }>;
  /** e-Stat time code ("2024000101" = Jan 2024) → the value text, sorted */
  values: Array<{ time: string; value: string }>;
};

export const seriesKey = (id: string, codes: Record<string, string>) =>
  `${id}/${Object.entries(codes)
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;

/** Split a table response into one file per series. */
export function splitSeries(table: EstatTable): EstatSeriesFile[] {
  const classIds = table.classes.map((c) => c.id).filter((id) => id !== "time");
  const names = new Map(table.classes.map((c) => [c.id, c]));
  const out = new Map<string, EstatSeriesFile>();
  for (const v of table.values) {
    const codes = Object.fromEntries(
      classIds.map((id) => [id, v[`@${id}`] ?? ""]),
    );
    const key = seriesKey(table.statsDataId, codes);
    let s = out.get(key);
    if (!s) {
      s = {
        statsDataId: table.statsDataId,
        title: table.title,
        codes,
        labels: Object.fromEntries(
          classIds.map((id) => {
            const c = names.get(id)!;
            const code = c.codes.find((x) => x["@code"] === codes[id]);
            return [id, { class: c.name, code: code?.["@name"] ?? "" }];
          }),
        ),
        unit: v["@unit"] ?? null,
        notes: table.notes,
        values: [],
      };
      out.set(key, s);
    }
    s.values.push({ time: v["@time"] ?? "", value: v.$ ?? "" });
  }
  for (const s of out.values()) {
    s.values.sort((a, b) => a.time.localeCompare(b.time));
  }
  return [...out.values()];
}

type TableRequest = {
  statsDataId: string;
  /** The load statements' filters for this table (classifications only) */
  filters: Array<Record<string, string>>;
};

async function wantedTables(ctx: FetchContext): Promise<TableRequest[]> {
  const tables = new Map<string, TableRequest>();
  for (const f of await ctx.referencedFilters()) {
    const id = String(f.stats_data_id ?? "").trim();
    if (!ID_RE.test(id)) {
      ctx.warn(
        `${JSON.stringify(f)}: "${f.stats_data_id ?? ""}" is not an e-Stat statsDataId; ignored`,
      );
      continue;
    }
    const classes = Object.fromEntries(
      Object.entries(f)
        .filter(([k]) => k !== "stats_data_id" && k !== "frequency")
        .map(([k, v]) => [k, v.trim()]),
    );
    const bad = Object.keys(classes).filter((k) => !CLASS_RE.test(k));
    if (bad.length) {
      ctx.warn(
        `${JSON.stringify(f)}: unknown classification ${bad.join(", ")}; ignored`,
      );
      continue;
    }
    const t = tables.get(id) ?? { statsDataId: id, filters: [] };
    t.filters.push(classes);
    tables.set(id, t);
  }
  return [...tables.values()].sort((a, b) =>
    a.statsDataId.localeCompare(b.statsDataId),
  );
}

/** cd filters covering every statement: a code union per classification. */
export function narrowing(
  filters: Array<Record<string, string>>,
): Record<string, string> {
  const keys = new Set(filters.flatMap((f) => Object.keys(f)));
  const out: Record<string, string> = {};
  for (const k of [...keys].sort()) {
    if (filters.some((f) => f[k] === undefined || f[k] === "-")) continue;
    out[k] = [...new Set(filters.map((f) => f[k]))].sort().join(",");
  }
  return out;
}

export async function fetchEstat(ctx: FetchContext): Promise<void> {
  const tables = await wantedTables(ctx);
  if (tables.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  const get = (url: string) => ctx.get(url);
  for (const t of tables) {
    await ctx.sleep(THROTTLE_MS);
    const cd = narrowing(t.filters);
    let table: EstatTable;
    try {
      table = await fetchStatsDataRaw(t.statsDataId, cd, get);
    } catch (e) {
      ctx.keyFailed(t.statsDataId, e instanceof Error ? e.message : String(e));
      continue;
    }
    const series = splitSeries(table);
    ctx.log(`${t.statsDataId} ${JSON.stringify(cd)}: ${series.length} series`);
    for (const s of series) {
      await ctx.store(
        seriesKey(t.statsDataId, s.codes),
        new TextEncoder().encode(JSON.stringify(s)),
        {
          contentType: "application/json",
          originalName: `${t.statsDataId}_${Object.values(s.codes).join("_")}.json`,
          metadata: {
            statsDataId: t.statsDataId,
            updatedDate: table.updatedDate,
          },
        },
      );
    }
    for (const f of t.filters) {
      const hit = series.some((s) =>
        Object.entries(f).every(([k, v]) => (s.codes[k] ?? "-") === v),
      );
      if (!hit) {
        ctx.warn(
          `${t.statsDataId} ${JSON.stringify(f)}: no such series in the table`,
        );
      }
    }
  }
}
