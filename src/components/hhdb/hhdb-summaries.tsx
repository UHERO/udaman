"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  type FreqSummaryResult,
  type SummaryViewType,
} from "@catalog/types/hhdb";
import {
  getFieldsForViewType,
  HHDB_DATA_DICTIONARY,
} from "@catalog/types/hhdb-data-dictionary";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
} from "lucide-react";

import { getHhdbFreqSummary } from "@/actions/hhdb";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

/** TMK first-digit → county name */
const ISLANDS = [
  { code: "1", label: "Oahu" },
  { code: "2", label: "Maui" },
  { code: "3", label: "Hawaii" },
  { code: "4", label: "Kauai" },
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s)|^\w{3} \w{3} \d{2} \d{4}/;

/** Format date-like strings as "Wed, Aug 25, 2004", pass others through. */
function displayValue(val: string): string {
  if (DATE_RE.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return val;
}

/** Format null count as "138 (5%)" */
function formatNullCell(nullCount: number, total: number): string {
  if (nullCount === 0) return "";
  const pct = total > 0 ? Math.round((nullCount / total) * 100) : 0;
  return `${nullCount.toLocaleString()} (${pct}%)`;
}

function FreqSortHeader({
  label,
  colKey,
  sortCol,
  sortDir,
  onSort,
}: {
  label: string;
  colKey: string;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  const isActive = sortCol === colKey;
  return (
    <th
      className="hover:text-foreground cursor-pointer pb-2 text-right font-medium select-none"
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive &&
          (sortDir === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          ))}
      </span>
    </th>
  );
}

interface HhdbSummariesProps {
  tableName: string;
  basePath: string;
  selectedField?: string;
  viewType: SummaryViewType;
}

export function HhdbSummaries({
  tableName,
  basePath,
  selectedField,
  viewType,
}: HhdbSummariesProps) {
  // Filter dictionary fields to only those supporting this view type
  const viewFields = getFieldsForViewType(tableName, viewType);
  const allDictFields = HHDB_DATA_DICTIONARY[tableName];

  const [freqResult, setFreqResult] = useState<FreqSummaryResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Freq pagination / sort state
  const [freqPage, setFreqPage] = useState(1);
  const [freqSortCol, setFreqSortCol] = useState("0");
  const [freqSortDir, setFreqSortDir] = useState<"asc" | "desc">("desc");
  const [freqSearch, setFreqSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const selectedDef = allDictFields?.find((f) => f.key === selectedField);
  const fieldSupportsView = selectedDef?.summary?.includes(viewType);
  const hasSummary = fieldSupportsView && !selectedDef?.disabled;

  // Reset state when field or view type changes
  useEffect(() => {
    setFreqPage(1);
    setFreqSortCol("0");
    setFreqSortDir("desc");
    setFreqSearch("");
    setDebouncedSearch("");
  }, [selectedField, viewType]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(freqSearch);
      setFreqPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [freqSearch]);

  // Fetch freq data
  useEffect(() => {
    if (!selectedField || !hasSummary) return;

    startTransition(async () => {
      const data = await getHhdbFreqSummary(tableName, selectedField, {
        page: freqPage,
        limit: PAGE_SIZE,
        sortCol: freqSortCol,
        sortDir: freqSortDir,
        search: debouncedSearch || undefined,
      });
      setFreqResult(data);
    });
  }, [
    tableName,
    selectedField,
    hasSummary,
    freqPage,
    freqSortCol,
    freqSortDir,
    debouncedSearch,
  ]);

  // Clear data when field is deselected
  useEffect(() => {
    if (!selectedField || !hasSummary) {
      setFreqResult(null);
    }
  }, [selectedField, hasSummary]);

  const handleFreqSort = useCallback(
    (col: string) => {
      if (col === freqSortCol) {
        setFreqSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setFreqSortCol(col);
        setFreqSortDir("desc");
      }
      setFreqPage(1);
    },
    [freqSortCol],
  );

  if (!viewFields || viewFields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No fields available for this view.
      </p>
    );
  }

  const totalPages = freqResult ? Math.ceil(freqResult.total / PAGE_SIZE) : 0;

  return (
    <div className="flex gap-6">
      {/* Left panel: field list */}
      <div className="w-52 shrink-0">
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Fields
        </h3>
        <div className="max-h-[600px] space-y-0.5 overflow-y-auto">
          {viewFields.map((f) => {
            if (f.disabled) {
              return (
                <span
                  key={f.key}
                  title={f.disabledReason}
                  className="text-muted-foreground block w-full cursor-not-allowed rounded px-3 py-1.5 text-left text-sm opacity-50"
                >
                  {f.label}
                </span>
              );
            }
            const isSelected = selectedField === f.key;
            return (
              <Link
                key={f.key}
                href={`${basePath}/${f.key}`}
                className={cn(
                  "block w-full rounded px-3 py-1.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right panel: results */}
      <div className="min-w-0 flex-1">
        {!selectedField && (
          <p className="text-muted-foreground pt-8 text-center text-sm">
            Select a field to view its description and summary statistics.
          </p>
        )}

        {selectedField && selectedDef && (
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="mb-1 text-lg font-semibold">
                {selectedDef.label}
              </h3>
              {viewType === "summary" &&
                freqResult?.generatedAt &&
                !isPending && (
                  <span className="text-muted-foreground text-xs">
                    ·{" "}
                    {new Date(freqResult.generatedAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                )}
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {selectedDef.description}
            </p>

            {/* Info-only fields (no summary for this view) */}
            {!hasSummary && (
              <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {selectedDef.disabled
                    ? selectedDef.disabledReason
                    : "This field contains unique or unstructured values that cannot be summarized. Use the Data tab to browse individual records, or query the database directly for analysis."}
                </p>
              </div>
            )}

            {/* Loading state for summary fields */}
            {hasSummary && isPending && (
              <div className="flex items-center justify-center pt-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            )}

            {/* Freq-based summary results */}
            {hasSummary &&
              !isPending &&
              freqResult &&
              (() => {
                if (
                  freqResult.rows.length === 0 &&
                  !freqResult.nullRow &&
                  !debouncedSearch
                ) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      No frequency data available for this field.
                    </p>
                  );
                }

                // Compute null percentages using the null row's own statewide total
                const nullTotals: Record<string, number> = {};
                if (freqResult.nullRow) {
                  // The statewide total for this county is the sum of all values
                  // We only have the null row counts; the overall total per county
                  // can be derived from null + non-null. We'll just use the null
                  // count as-is with the statewide count from county_code=0
                  // For proper percentage we need total records per county.
                  // Since we paginate, we can't sum the page — use null as absolute.
                  for (const [code, freq] of Object.entries(
                    freqResult.nullRow.counts,
                  )) {
                    nullTotals[code] = freq;
                  }
                }

                return (
                  <div>
                    {/* Search + count bar */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="relative max-w-64 flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search values..."
                          value={freqSearch}
                          onChange={(e) => setFreqSearch(e.target.value)}
                          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-8 w-full rounded-md border py-1 pr-3 pl-8 text-sm outline-none focus:ring-1"
                        />
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {freqResult.total.toLocaleString()} unique value
                        {freqResult.total !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="max-h-[480px] overflow-y-auto">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="w-1/3 pb-2 font-medium">Value</th>
                            {ISLANDS.map((i) => (
                              <FreqSortHeader
                                key={i.code}
                                label={i.label}
                                colKey={i.code}
                                sortCol={freqSortCol}
                                sortDir={freqSortDir}
                                onSort={handleFreqSort}
                              />
                            ))}
                            <FreqSortHeader
                              label="State"
                              colKey="0"
                              sortCol={freqSortCol}
                              sortDir={freqSortDir}
                              onSort={handleFreqSort}
                            />
                          </tr>
                          {freqResult.nullRow && (
                            <tr className="border-b text-xs">
                              <td className="text-muted-foreground py-1.5 italic">
                                NULL
                              </td>
                              {ISLANDS.map((i) => (
                                <td
                                  key={i.code}
                                  className="text-muted-foreground py-1.5 text-right italic tabular-nums"
                                >
                                  {formatNullCell(
                                    freqResult.nullRow!.counts[i.code] ?? 0,
                                    freqResult.totalCounts[i.code] ?? 0,
                                  )}
                                </td>
                              ))}
                              <td className="text-muted-foreground py-1.5 text-right font-medium italic tabular-nums">
                                {formatNullCell(
                                  freqResult.nullRow!.counts["0"] ?? 0,
                                  freqResult.totalCounts["0"] ?? 0,
                                )}
                              </td>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {freqResult.rows.map((row) => (
                            <tr
                              key={row.value}
                              className="border-b last:border-0"
                            >
                              <td className="py-1.5 break-words">
                                {displayValue(row.value)}
                              </td>
                              {ISLANDS.map((i) => (
                                <td
                                  key={i.code}
                                  className="py-1.5 text-right tabular-nums"
                                >
                                  {(row.counts[i.code] ?? 0) > 0
                                    ? (row.counts[i.code] ?? 0).toLocaleString()
                                    : ""}
                                </td>
                              ))}
                              <td className="py-1.5 text-right font-medium tabular-nums">
                                {(row.counts["0"] ?? 0) > 0
                                  ? (row.counts["0"] ?? 0).toLocaleString()
                                  : ""}
                              </td>
                            </tr>
                          ))}
                          {freqResult.rows.length === 0 && debouncedSearch && (
                            <tr>
                              <td
                                colSpan={6}
                                className="text-muted-foreground py-6 text-center"
                              >
                                No values matching &ldquo;{debouncedSearch}
                                &rdquo;
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          Page {freqPage} of {totalPages.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={freqPage <= 1}
                            onClick={() => setFreqPage((p) => p - 1)}
                            className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            disabled={freqPage >= totalPages}
                            onClick={() => setFreqPage((p) => p + 1)}
                            className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}
