import type { FieldCategory } from "../types/hhdb";
import { getDictionaryLabel } from "../types/hhdb-data-dictionary";

const ID_RE = /^id$|_id$|^tmk$|^parent_tmk$|^parcel_number$/;
const YEAR_RE = /year/i;
const DOLLAR_RE =
  /value|amount|price|tax|assessment|exemption|penalty|interest|credit|payment|net_tax|conveyance/i;
const AREA_RE = /sqft|acres|area|acreage|square_footage|perimeter/i;
const COUNT_RE =
  /bedrooms|floors|units|parking|count|bath|room|building_number|sequence|living_units|buildings|quantity|dimensions/i;
const BLOB_RE = /url|note|legal_information|sketch|description|address/i;

const DATE_TYPES = new Set(["date", "datetime", "timestamp"]);
const TEXT_TYPES = new Set(["text", "longtext", "mediumtext", "tinytext"]);

export function classifyField(
  columnName: string,
  dataType: string,
  columnType: string,
  distinctCount?: number,
): FieldCategory {
  const dt = dataType.toLowerCase();

  // 1. DATE/DATETIME/TIMESTAMP
  if (DATE_TYPES.has(dt)) return "date";

  // 2. TEXT/LONGTEXT or blob-like names
  if (TEXT_TYPES.has(dt) || BLOB_RE.test(columnName)) return "blob";

  // 3. Identifiers
  if (ID_RE.test(columnName)) return "identifier";

  // 4. SMALLINT/INT year columns
  if ((dt === "smallint" || dt === "int") && YEAR_RE.test(columnName))
    return "year";

  // 5. BIGINT dollar columns
  if (dt === "bigint" && DOLLAR_RE.test(columnName)) return "large-dollar";

  // 6. DECIMAL dollar columns
  if (dt === "decimal" && DOLLAR_RE.test(columnName)) return "small-dollar";

  // 7. Area columns
  if (AREA_RE.test(columnName)) return "area";

  // 8. Count columns (SMALLINT/INT + count-like name)
  if ((dt === "smallint" || dt === "int") && COUNT_RE.test(columnName))
    return "count";

  // 9. Remaining BIGINT/INT → count
  if (dt === "bigint" || dt === "int" || dt === "smallint" || dt === "tinyint")
    return "count";

  // 10. Remaining DECIMAL → small-dollar
  if (dt === "decimal" || dt === "double" || dt === "float")
    return "small-dollar";

  // 11. VARCHAR/CHAR by cardinality
  if (dt === "varchar" || dt === "char" || dt === "enum") {
    if (distinctCount != null && distinctCount <= 200) return "low-cardinality";
    return "high-cardinality";
  }

  return "high-cardinality";
}

/** Convert snake_case column name to Title Case, with dictionary label override. */
export function columnLabel(tableName: string, columnName: string): string {
  const dictLabel = getDictionaryLabel(tableName, columnName);
  if (dictLabel) return dictLabel;
  return columnName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
