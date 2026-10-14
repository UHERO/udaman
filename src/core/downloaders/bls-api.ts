/**
 * bls_api — the BLS v2 API, batched.
 *
 *   Series.load_from_bls_api "CUSR0000SA0", "M"
 *
 * Same arguments as load_api_bls, so moving a loader over is a rename.
 * The series to fetch are collected from the load statements themselves.
 *
 * History is fetched once: a series without a `completeAt` entry in
 * state.history gets the full 20-year-window walk (≈ 4–5 requests per 50
 * series); after that each run refetches only the last `refetchYears`
 * (default 20 = one request per 50 series) and merges it over the stored
 * rows from that year on. "Force full refetch" (full: true) ignores the
 * history map.
 */

import { fetchSeriesBatchHistory } from "@catalog/utils/api-clients/bls";

import type { DownloaderImpl, TidyRow } from "./types";

type HistoryEntry = { completeAt: string; earliest: string };

function seriesIdArg(v: unknown): string {
  const id = String(v ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{5,30}$/.test(id)) {
    throw new Error(
      `load_from_bls_api: "${String(v)}" is not a BLS series ID (e.g. "CUSR0000SA0")`,
    );
  }
  return id;
}

export const blsApi: DownloaderImpl = {
  handle: "bls_api",
  loadMethod: "load_from_bls_api",
  loadSignature: 'load_from_bls_api("<BLS series ID>", "<A|S|Q|M>")',
  outputHandle: "BLS_API@bls.gov",
  supportsKeyedRuns: true,

  keyFromArgs(args) {
    const id = seriesIdArg(args[0]);
    const freq =
      args[1] == null || args[1] === "" ? undefined : String(args[1]).trim();
    if (freq && !/^[ASQMWD]$/i.test(freq)) {
      throw new Error(
        `load_from_bls_api: frequency "${freq}" must be one of A, S, Q, M`,
      );
    }
    return {
      key: id,
      frequency: freq?.toUpperCase(),
      label: `BLS series ${id}`,
    };
  },

  async run(ctx) {
    const refetchYears = Number(
      ctx.downloader.configValue<number>("refetchYears", 20),
    );
    const history = {
      ...((ctx.downloader.state.history as Record<string, HistoryEntry>) ?? {}),
    };
    const ids = ctx.keys ?? (await ctx.referencedKeys());
    if (ids.length === 0) {
      ctx.log("no load_from_bls_api load statements reference this downloader");
      return { write: null, stats: { keys: 0 } };
    }

    const newIds = ids.filter((id) => ctx.full || !history[id]?.completeAt);
    const knownIds = ids.filter((id) => !newIds.includes(id));
    const endYear = new Date().getFullYear();
    const windowStart = endYear - refetchYears + 1;

    ctx.log(
      `${newIds.length} series need full history, ${knownIds.length} refresh ${windowStart}–${endYear}`,
    );
    const full = newIds.length
      ? await fetchSeriesBatchHistory(newIds, { endYear, log: ctx.log })
      : null;
    const recent = knownIds.length
      ? await fetchSeriesBatchHistory(knownIds, {
          endYear,
          earliestYear: windowStart,
          log: ctx.log,
        })
      : null;

    const rows: TidyRow[] = [];
    const replaceFrom: Record<string, string> = {};
    const failed: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const [res, isFull] of [
      [full, true],
      [recent, false],
    ] as const) {
      if (!res) continue;
      for (const [id, data] of res.data) {
        const freq = res.freq.get(id);
        for (const [date, value] of data) {
          rows.push({ key: id, date, value, ...(freq ? { freq } : {}) });
        }
        if (!isFull) {
          replaceFrom[id] = `${windowStart}-01-01`;
        } else if (res.failed.has(id)) {
          // An older window failed: keep whatever is stored before the
          // windows that did arrive, and retry the full walk next run.
          replaceFrom[id] = `${res.windowStart.get(id)}-01-01`;
        } else {
          history[id] = {
            completeAt: today,
            earliest: [...data.keys()].sort()[0],
          };
        }
      }
      for (const [id, msg] of res.failed) {
        failed.push(id);
        ctx.log(`${id}: ${msg}`);
      }
    }

    ctx.setState({ history });
    return {
      write: { mode: "merge", rows, replaceFrom },
      failedKeys: failed,
      stats: {
        keys: ids.length,
        fullHistoryKeys: newIds.length,
        refreshedKeys: knownIds.length,
        refetchWindow: `${windowStart}-${endYear}`,
        requests: (full?.requests ?? 0) + (recent?.requests ?? 0),
        rowsFetched: rows.length,
      },
    };
  },
};
