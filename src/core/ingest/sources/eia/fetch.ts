/**
 * Acquire EIA series: the load statements are grouped by route and
 * frequency, and each group is one request (all pages) for every series id
 * and scenario in it (EIA returns every combination). The response is
 * split by (scenario, series id) and each is stored as its own artifact,
 * holding only the series' own fields and its points oldest first — not
 * the request echo or apiVersion, so a new vintage means new data.
 */

import {
  EIA_FREQUENCY,
  fetchRouteDataRaw,
} from "@catalog/utils/api-clients/eia";

import type { FetchContext } from "../../types";

const THROTTLE_MS = 500;
const ROUTE_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/i;

/** What one stored artifact holds. */
export type EiaSeriesFile = {
  route: string;
  /** "-" when the route has no scenarios */
  scenario: string;
  seriesId: string;
  frequency: string;
  name: string | null;
  unit: string | null;
  data: Array<{ period: string; value: string | null }>;
};

export const eiaKey = (s: {
  route: string;
  scenario: string;
  seriesId: string;
  frequency: string;
}) => `${s.route}/${s.scenario}/${s.seriesId}/${s.frequency}`;

type Wanted = {
  route: string;
  scenario: string;
  seriesId: string;
  frequency: string;
};

async function wanted(ctx: FetchContext): Promise<Wanted[]> {
  const out = new Map<string, Wanted>();
  for (const f of await ctx.referencedFilters()) {
    const route = String(f.route ?? "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const seriesId = String(f.series_id ?? "").trim();
    const scenario = String(f.scenario ?? "-").trim() || "-";
    const frequency = String(f.frequency ?? "")
      .trim()
      .toUpperCase();
    const what = JSON.stringify(f);
    if (!ROUTE_RE.test(route))
      ctx.warn(`${what}: no route (e.g. "steo", "aeo/2025"); ignored`);
    else if (!seriesId) ctx.warn(`${what}: no series_id; ignored`);
    else if (!EIA_FREQUENCY[frequency]) {
      ctx.warn(
        `${what}: no frequency (give one, or load into a series whose name ends in .A/.Q/.M/.W/.D); ignored`,
      );
    } else {
      const w = { route, scenario, seriesId, frequency };
      out.set(eiaKey(w), w);
    }
  }
  return [...out.values()];
}

export async function fetchEia(ctx: FetchContext): Promise<void> {
  const all = await wanted(ctx);
  if (all.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  const groups = new Map<string, Wanted[]>();
  for (const w of all) {
    const g = `${w.route} ${w.frequency}`;
    groups.set(g, [...(groups.get(g) ?? []), w]);
  }
  const get = (url: string) => ctx.get(url);
  for (const [g, ws] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const { route, frequency } = ws[0];
    const seriesIds = [...new Set(ws.map((w) => w.seriesId))].sort();
    const scenarios = [...new Set(ws.map((w) => w.scenario))]
      .filter((s) => s !== "-")
      .sort();
    if (scenarios.length && ws.some((w) => w.scenario === "-")) {
      ctx.warn(
        `${g}: some load statements give a scenario and some don't; those without are left out`,
      );
    }
    await ctx.sleep(THROTTLE_MS);
    let rows: Array<Record<string, string | null>>;
    try {
      rows = await fetchRouteDataRaw(
        route,
        frequency,
        { seriesId: seriesIds, scenario: scenarios },
        get,
      );
    } catch (e) {
      ctx.keyFailed(g, e instanceof Error ? e.message : String(e));
      continue;
    }
    const files = new Map<string, EiaSeriesFile>();
    for (const r of rows) {
      const s = {
        route,
        scenario: scenarios.length ? String(r.scenario ?? "") : "-",
        seriesId: String(r.seriesId ?? ""),
        frequency,
      };
      const key = eiaKey(s);
      let f = files.get(key);
      if (!f) {
        f = {
          ...s,
          name: r.seriesName ?? r.seriesDescription ?? null,
          unit: r.unit ?? null,
          data: [],
        };
        files.set(key, f);
      }
      f.data.push({ period: String(r.period ?? ""), value: r.value ?? null });
    }
    ctx.log(`${g}: ${rows.length} rows, ${files.size} series`);
    for (const [key, f] of files) {
      f.data.sort((a, b) => a.period.localeCompare(b.period));
      await ctx.store(key, new TextEncoder().encode(JSON.stringify(f)), {
        contentType: "application/json",
        originalName: `${key.replace(/\//g, "_")}.json`,
        metadata: {
          route,
          scenario: f.scenario,
          seriesId: f.seriesId,
          frequency,
        },
      });
    }
    for (const w of ws) {
      if (!files.has(eiaKey(w)) && !(scenarios.length && w.scenario === "-")) {
        ctx.warn(
          `${eiaKey(w)}: not in the response (check the route, scenario and series id; they are case-sensitive)`,
        );
      }
    }
  }
}
