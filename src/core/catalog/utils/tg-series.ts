import { rawQuery } from "@/lib/mysql/hhdb";

const AGGREGATES = {
  monthly: { format: "%Y-%m-01", frequency: "M" },
  annually: { format: "%Y-01-01", frequency: "A" },
} as const;

const FIELDS = {
  sales: { sql: "COUNT(*)", label: "sales" },
  dollar_volume: {
    sql: "SUM(t.considerationAmount)",
    label: "dollar volume",
  },
} as const;

const COUNTY_DIGITS = {
  HON: "1",
  MAU: "2",
  HAW: "3",
  KAU: "4",
} as const;

const SALE_DOC_TYPES = [
  "APARTMENT DEED (FEE)",
  "DEED",
  "CONDOMINIUM CONVEYANCE DOCUMENT",
  "AGREEMENT OF SALE",
] as const;

const TAX_CLASS_GROUPS = {
  residential: [
    "RESIDENTIAL",
    "RESIDENTIAL A",
    "OWNER-OCCUPIED",
    "HOMEOWNER",
    "NON-OWNER-OCCUPIED",
    "NON-HOMEOWNER",
    "IMPROVED RESIDENTIAL",
    "UNIMPROVED RESIDENTIAL",
    "SINGLE FAMILY RESIDENTIAL",
    "HOMESTEAD",
    "LONG TERM RENTAL",
    "RESIDENTIAL INVESTOR",
  ],
  commercial: [
    "COMMERCIAL",
    "INDUSTRIAL",
    "HOTEL AND RESORT",
    "VACATION RENTAL",
    "TRANSIENT VACATION RENTAL",
    "TRANSIENT VACATION",
    "TIME SHARE",
    "BED AND BREAKFAST HOME",
    "COMMERCIALIZED RESIDENTIAL",
    "APARTMENT",
    "OWNER-OCCUPIED MIXED-USE",
  ],
  other: [
    "PRESERVATION",
    "AGRICULTURE",
    "VACANT AGRICULTURE",
    "AGRICULTURAL OR NATIVE FORESTS",
    "CONSERVATION",
    "PUBLIC SERVICE",
    "AFFORDABLE RENTAL HOUSING",
  ],
} as const;

type FilterValue = string | number | boolean | undefined;
type TgFilters = Record<string, Exclude<FilterValue, undefined>>;

type SqlPart = {
  sql: string;
  params: string[];
  label?: string;
};

type AreaFilter = SqlPart & {
  label: string;
  from: string;
};

const EMPTY_PART: SqlPart = { sql: "", params: [] };

export async function fetchSeries(
  filters: TgFilters = {},
): Promise<{
  data: Map<string, number>;
  frequency: "A" | "M";
  name: string;
}> {
  const aggregate = normalizeAggregate(filters.aggregate);
  const field = requireKey(
    FIELDS,
    filters.field,
    "need field=sales or dollar_volume",
  );
  const area = normalizeArea(filters.area ?? filters.geography);
  const buyer = normalizeBuyer(filters);
  const taxClass = normalizeTaxClass(filters);
  const docTypes = [...SALE_DOC_TYPES];

  /* 
   * building out the query
   * added a consideration amount minimum of 50k
   */
  const sql = `
    SELECT
      DATE_FORMAT(t.recDate, '${aggregate.format}') AS observation_date,
      ${field.sql} AS value
    FROM ${area.from}
    WHERE t.recDate IS NOT NULL
      AND t.considerationAmount > 50000
      AND t.docType IN (${docTypes.map(() => "?").join(", ")})
      ${area.sql}
      ${buyer.sql}
      ${taxClass.sql}
    GROUP BY observation_date
    ORDER BY observation_date
  `;

  const rows = await rawQuery<{
    observation_date: string | Date;
    value: string | number;
  }>(sql, [...docTypes, ...area.params, ...buyer.params, ...taxClass.params]);

  const data = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.value);
    if (Number.isFinite(value)) data.set(dateKey(row.observation_date), value);
  }

  return {
    data,
    name: [`TG ${field.label} in ${area.label}`, buyer.label, taxClass.label]
      .filter(Boolean)
      .join(", "),
    frequency: aggregate.frequency,
  };
}

function normalizeAggregate(value: FilterValue): (typeof AGGREGATES)[keyof typeof AGGREGATES] {
  const aggregate = AGGREGATES[
    clean(value)?.toLowerCase() as keyof typeof AGGREGATES
  ];
  if (aggregate) {
    return aggregate;
  }
  throw new Error("need aggregate=monthly or annually");
}

function normalizeArea(value: FilterValue): AreaFilter {
  const raw = String(value ?? "").trim().toUpperCase();
  /* zip code */
  if (/^\d{5}$/.test(raw)) {
    return area(
      "AND p.zip >= ? AND p.zip < ?",
      [raw, String(Number(raw) + 1).padStart(5, "0")],
      raw,
      "properties p FORCE INDEX (idx_zip) STRAIGHT_JOIN tg_transactions t FORCE INDEX (idx_tg_zip_join) ON t.tmk = p.tmk",
    );
  }

  if (raw === "HI") {
    return area("", [], "HI", "tg_transactions t USE INDEX (idx_tg_loader_state)");
  }

  if (raw in COUNTY_DIGITS) {
    const digit = COUNTY_DIGITS[raw as keyof typeof COUNTY_DIGITS];
    return area(
      "AND t.taxKey >= ? AND t.taxKey < ?",
      [digit, String(Number(digit) + 1)],
      raw,
      "tg_transactions t USE INDEX (idx_tg_loader_county)",
    );
  }

  throw new Error("bad area/geography");
}

function normalizeTaxClass(filters: TgFilters): SqlPart {
  const taxClass = clean(filters.tax_class)?.toLowerCase() || "residential";

  if (taxClass === "any") {
    return EMPTY_PART;
  }

  const group = TAX_CLASS_GROUPS[taxClass as keyof typeof TAX_CLASS_GROUPS];
  if (!group) {
    throw new Error("need tax_class=residential, commercial, other, or any");
  }

  return {
    sql: `AND UPPER(TRIM(COALESCE(t.taxClass, ''))) IN (${group
      .map(() => "?")
      .join(", ")})`,
    params: [...group],
    label: `tax class ${taxClass}`,
  };
}

function normalizeBuyer(filters: TgFilters): SqlPart {
  const state = clean(filters.buyer_state)?.toUpperCase();
  const country = clean(filters.buyer_country)?.toUpperCase();

  if (state && country) {
    throw new Error("use buyer_state or buyer_country, not both");
  }

  if (state) {
    return {
      sql: "AND UPPER(TRIM(COALESCE(t.mailingState, ''))) = ?",
      params: [state],
      label: `buyer state ${state}`,
    };
  }

  if (country) {
    return {
      sql: "AND UPPER(TRIM(COALESCE(t.mailingCountry, ''))) = ?",
      params: [country],
      label: `buyer country ${country}`,
    };
  }

  return EMPTY_PART;
}

function requireKey<T extends Record<string, unknown>>(
  options: T,
  value: FilterValue,
  message: string,
): T[keyof T] {
  const match = options[clean(value)?.toLowerCase() as keyof T];
  if (match) {
    return match as T[keyof T];
  }
  throw new Error(message);
}

function area(
  sql: string,
  params: string[],
  label: string,
  from: string,
): AreaFilter {
  return { sql, params, label, from };
}

function dateKey(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function clean(value: FilterValue): string | null {
  const raw = String(value ?? "").trim();
  return raw || null;
}
