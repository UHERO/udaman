/**
 * Statistics Canada Web Data Service (WDS), the vector endpoints.
 * https://www.statcan.gc.ca/en/developers/wds/user-guide
 *
 * No API key. 25 requests/second per IP. Data is released at 8:30 ET on
 * business days; from midnight to 8:30 ET some tables answer 409.
 *
 * Quirks (checked live 2026-11-05):
 *  - Results are not in request order: match them on vectorId.
 *  - An unknown vector is a 200 with `status: "FAILED"` and an empty
 *    vectorDataPoint (responseStatusCode 3 or 4).
 *  - A malformed body is a 200 with a top-level `{ message }`, not an array.
 *  - `value` has the decimals applied but not the scalar factor: an LFS
 *    vector with scalarFactorCode 3 is in thousands.
 *  - frequencyCode is not always the series' period: v1 (population, a
 *    quarterly point estimate) is 21, "occasional daily".
 */

export const WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

/** WDS frequencyCode → one-letter frequency, for the regular periods. */
export const STATCAN_FREQUENCY: Record<number, string> = {
  1: "D",
  2: "W",
  6: "M",
  9: "Q",
  11: "S",
  12: "A",
};

/** WDS scalarFactorCode → the word for the unit multiplier. */
export const STATCAN_SCALAR: Record<number, string> = {
  0: "units",
  1: "tens",
  2: "hundreds",
  3: "thousands",
  4: "tens of thousands",
  5: "hundreds of thousands",
  6: "millions",
  7: "tens of millions",
  8: "hundreds of millions",
  9: "billions",
};

export type WdsPoint = {
  refPer: string;
  refPer2?: string;
  refPerRaw?: string;
  refPerRaw2?: string;
  value: number | null;
  decimals?: number;
  scalarFactorCode?: number;
  symbolCode?: number;
  statusCode?: number;
  securityLevelCode?: number;
  releaseTime: string;
  frequencyCode?: number;
};

/** One vector's object of a data response. */
export type WdsVectorData = {
  vectorId: number;
  productId: number;
  coordinate: string;
  vectorDataPoint: WdsPoint[];
};

export type WdsSeriesInfo = {
  vectorId: number;
  productId: number;
  coordinate: string;
  frequencyCode: number;
  scalarFactorCode: number;
  decimals: number;
  terminated: number;
  SeriesTitleEn: string;
  memberUomCode: number;
};

export type WdsFailure = { vectorId: number; responseStatusCode: number };

export type WdsResult<T> = { ok: T[]; failed: WdsFailure[] };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

type Envelope = {
  status?: string;
  object?: Record<string, unknown> & { vectorId?: number };
};

async function post(
  fetchImpl: Fetch,
  method: string,
  body: unknown,
): Promise<Envelope[]> {
  const res = await fetchImpl(`${WDS_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    const msg =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : JSON.stringify(json).slice(0, 300);
    throw new Error(`WDS ${method}: ${msg}`);
  }
  return json as Envelope[];
}

function split<T>(method: string, envelopes: Envelope[]): WdsResult<T> {
  const ok: T[] = [];
  const failed: WdsFailure[] = [];
  for (const e of envelopes) {
    const o = e.object;
    if (!o || typeof o.vectorId !== "number") {
      throw new Error(`WDS ${method}: an answer without a vectorId`);
    }
    if (e.status === "SUCCESS") ok.push(o as unknown as T);
    else {
      failed.push({
        vectorId: o.vectorId,
        responseStatusCode: Number(o.responseStatusCode ?? -1),
      });
    }
  }
  return { ok, failed };
}

/** The last `latestN` periods of each vector (100000 = the full history). */
export async function fetchVectorsLatestN(
  vectorIds: number[],
  latestN: number,
  fetchImpl: Fetch = fetch,
): Promise<WdsResult<WdsVectorData>> {
  if (vectorIds.length === 0) return { ok: [], failed: [] };
  const m = "getDataFromVectorsAndLatestNPeriods";
  return split(
    m,
    await post(
      fetchImpl,
      m,
      vectorIds.map((vectorId) => ({ vectorId, latestN })),
    ),
  );
}

/**
 * Every point of each vector whose release time is in [start, end]
 * ("YYYY-MM-DDTHH:MM", Eastern time) — revisions included, however far
 * back their reference period.
 */
export async function fetchBulkByReleaseRange(
  vectorIds: number[],
  start: string,
  end: string,
  fetchImpl: Fetch = fetch,
): Promise<WdsResult<WdsVectorData>> {
  if (vectorIds.length === 0) return { ok: [], failed: [] };
  const m = "getBulkVectorDataByRange";
  return split(
    m,
    await post(fetchImpl, m, {
      vectorIds: vectorIds.map(String),
      startDataPointReleaseDate: start,
      endDataPointReleaseDate: end,
    }),
  );
}

/** Title, table, coordinate, frequency, scalar factor and unit of each vector. */
export async function fetchSeriesInfo(
  vectorIds: number[],
  fetchImpl: Fetch = fetch,
): Promise<WdsResult<WdsSeriesInfo>> {
  if (vectorIds.length === 0) return { ok: [], failed: [] };
  const m = "getSeriesInfoFromVector";
  return split(
    m,
    await post(
      fetchImpl,
      m,
      vectorIds.map((vectorId) => ({ vectorId })),
    ),
  );
}

/** "14100287" → "14-10-0287-01" (the table number StatCan prints). */
export function tableNumber(productId: number | string): string {
  const s = String(productId).padStart(8, "0");
  return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 8)}-01`;
}
