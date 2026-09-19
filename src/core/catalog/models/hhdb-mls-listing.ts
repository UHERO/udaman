import { MLS_COLUMNS, type MlsColumnKind } from "@/core/crawlers/mls/columns";

/**
 * Read model for `mls_listings`. The ~80 data columns are generated from
 * MLS_COLUMNS (the scraper's single source of truth) rather than hand-copied,
 * so keys stay snake_case — identical to the DB column, the table accessorKey
 * and the sort param.
 *
 * Pure data + types: safe to import from client components.
 */

/** Loader-owned columns exposed to the UI (see MLS_LOADER_COLUMNS for the full set). */
export const MLS_LISTING_LOADER_FIELDS = [
  "id",
  "mls_board",
  "mls_number",
  "status",
  "source_site",
  "source_url",
  "first_seen_at",
  "last_seen_at",
] as const;

/** Every column the list query selects, in display order. */
export const MLS_LISTING_SELECT_COLUMNS: readonly string[] = [
  ...MLS_LISTING_LOADER_FIELDS,
  ...MLS_COLUMNS.map((c) => c.column),
];

type KindValue<K extends MlsColumnKind> = K extends "int" | "money" | "year"
  ? number | null
  : string | null;

type MlsDataFields = {
  [C in (typeof MLS_COLUMNS)[number] as C["column"]]: KindValue<C["kind"]>;
};

export type HhdbMlsListingJSON = {
  id: number;
  mls_board: string | null;
  mls_number: string | null;
  status: string | null;
  source_site: string | null;
  source_url: string | null;
  /** DATETIME (HST wall-clock) serialized as ISO — format with formatHst, never a locale API. */
  first_seen_at: string | null;
  last_seen_at: string | null;
} & MlsDataFields;

export type HhdbMlsListingAttrs = Record<string, unknown>;

const NUMERIC_KINDS: ReadonlySet<MlsColumnKind> = new Set([
  "int",
  "money",
  "year",
]);

function toText(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** DATE column → "YYYY-MM-DD" (the driver anchors DATEs at UTC midnight). */
function toDateOnly(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

/** DATETIME column → ISO string whose UTC fields are the HST wall-clock. */
function toDateTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  return String(v);
}

export function hhdbMlsListingRowToJSON(
  attrs: HhdbMlsListingAttrs,
): HhdbMlsListingJSON {
  const out: Record<string, unknown> = {
    id: Number(attrs.id ?? 0),
    mls_board: toText(attrs.mls_board),
    mls_number: toText(attrs.mls_number),
    status: toText(attrs.status),
    source_site: toText(attrs.source_site),
    source_url: toText(attrs.source_url),
    first_seen_at: toDateTime(attrs.first_seen_at),
    last_seen_at: toDateTime(attrs.last_seen_at),
  };
  for (const col of MLS_COLUMNS) {
    const v = attrs[col.column];
    out[col.column] = NUMERIC_KINDS.has(col.kind)
      ? toNumber(v)
      : col.kind === "date"
        ? toDateOnly(v)
        : toText(v);
  }
  return out as HhdbMlsListingJSON;
}
