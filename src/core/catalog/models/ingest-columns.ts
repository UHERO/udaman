/**
 * Column coercions shared by the data-ingest models (DataDownloader,
 * RawArtifact, FetchRun, DataExtractor, ExtractionRun). DATETIME columns
 * are HST wall-clock (see @catalog/utils/time).
 */

/** JSON columns come back from Bun SQL as strings (MariaDB JSON = LONGTEXT). */
export function jsonValue(v: unknown): unknown {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return null;
  }
}

export function jsonObject(v: unknown): Record<string, unknown> {
  const parsed = jsonValue(v);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function jsonArray<T = unknown>(v: unknown): T[] {
  const parsed = jsonValue(v);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function toDate(v: Date | string | null | undefined): Date | null {
  return v ? new Date(v as string | Date) : null;
}

export function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** JSON column value for INSERT/UPDATE (null stays NULL). */
export function jsonParam(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}
