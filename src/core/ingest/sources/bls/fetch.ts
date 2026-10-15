/**
 * Acquire BLS series: the IDs come from the load statements that read an
 * extractor fed by this downloader (plus config.extraIds). Requests are
 * batched (50 IDs, 20-year windows) but every series is stored as its own
 * artifact, `<series id>/<start year>-<end year>` = that series' object of
 * the response, unchanged — so the hash depends on the series alone, not
 * on the batch it rode in or the response's timestamp.
 *
 * History is walked once per series (windows back from this year until one
 * comes back empty, recorded in state.history); after that each run
 * refetches only the last `refetchYears` (default 20 = one window).
 */

import { fetchSeriesBatchRaw } from "@catalog/utils/api-clients/bls";

import type { FetchContext } from "../../types";

const BATCH = 50;
const SPAN = 20;
const ID_RE = /^[A-Z0-9]{5,30}$/;

type HistoryEntry = { completeAt: string; earliest: number };

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function wantedIds(ctx: FetchContext): Promise<string[]> {
  const ids = new Set<string>();
  const extra = ctx.downloader.config.extraIds;
  const candidates = [
    ...(await ctx.referencedFilters()).map((f) => f.series_id),
    ...(Array.isArray(extra) ? extra.map(String) : []),
  ];
  for (const raw of candidates) {
    if (raw === undefined) continue;
    const id = raw.trim().toUpperCase();
    if (ID_RE.test(id)) ids.add(id);
    else ctx.warn(`"${raw}" is not a BLS series id; ignored`);
  }
  return [...ids].sort();
}

export async function fetchBls(ctx: FetchContext): Promise<void> {
  const refetchYears = Number(ctx.downloader.config.refetchYears ?? SPAN);
  const ids = await wantedIds(ctx);
  if (ids.length === 0) {
    ctx.log("no load statements read this downloader's extractors yet");
    return;
  }
  const history = {
    ...((ctx.state.history as Record<string, HistoryEntry>) ?? {}),
  };
  const today = new Date().toISOString().slice(0, 10);
  const endYear = new Date().getUTCFullYear();
  const fetchImpl = (url: string, init?: RequestInit) => ctx.get(url, init);

  /** One request; stores each returned series. Returns ids that had data. */
  const request = async (batch: string[], start: number, end: number) => {
    const withData = new Set<string>();
    try {
      const res = await fetchSeriesBatchRaw(batch, start, end, fetchImpl);
      for (const s of res.series) {
        if (s.points === 0) continue;
        await ctx.store(
          `${s.seriesID}/${start}-${end}`,
          new TextEncoder().encode(JSON.stringify(s.raw)),
          {
            contentType: "application/json",
            originalName: `${s.seriesID}_${start}-${end}.json`,
            metadata: { seriesId: s.seriesID, startYear: start, endYear: end },
          },
        );
        withData.add(s.seriesID);
      }
      return { withData, messages: res.messages, error: null };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      for (const id of batch) ctx.keyFailed(id, error);
      return { withData, messages: [], error };
    }
  };

  const newIds = ids.filter((id) => ctx.full || !history[id]?.completeAt);
  const known = ids.filter((id) => !newIds.includes(id));
  ctx.log(
    `${ids.length} series: ${newIds.length} need full history, ${known.length} refresh the last ${refetchYears} years`,
  );

  // full-history walk, 20-year windows back from this year
  let active = newIds;
  let end = endYear;
  const failed = new Set<string>();
  while (active.length && end >= 1900) {
    const start = end - SPAN + 1;
    const next: string[] = [];
    for (const batch of chunks(active, BATCH)) {
      const r = await request(batch, start, end);
      if (r.error) {
        batch.forEach((id) => failed.add(id));
        continue;
      }
      for (const id of batch) {
        if (r.withData.has(id)) {
          next.push(id);
        } else if (end === endYear) {
          ctx.warn(
            `${id}: no data in ${start}-${end} (does the series exist?)${r.messages.length ? ` ${r.messages.slice(0, 3).join(" ")}` : ""}`,
          );
        } else {
          history[id] = { completeAt: today, earliest: end + 1 };
        }
      }
    }
    active = next;
    end = start - 1;
  }
  for (const id of active)
    history[id] = { completeAt: today, earliest: end + 1 };

  // known series: the recent window only
  const windowStart = endYear - Math.max(1, Math.min(refetchYears, SPAN)) + 1;
  for (const batch of chunks(known, BATCH)) {
    const r = await request(batch, windowStart, endYear);
    if (r.error) continue;
    for (const id of batch) {
      if (!r.withData.has(id)) {
        ctx.warn(`${id}: no data in ${windowStart}-${endYear}`);
      }
    }
  }
  ctx.setState({ history });
}
