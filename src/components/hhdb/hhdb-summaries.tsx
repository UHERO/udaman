"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { type IslandCounts, type SummaryResult, type SummaryViewType } from "@catalog/types/hhdb";
import { HHDB_DATA_DICTIONARY, getFieldsForViewType } from "@catalog/types/hhdb-data-dictionary";
import { ArrowDown, Info, Loader2 } from "lucide-react";

import { getHhdbSummaries, getHhdbDistribution } from "@/actions/hhdb";
import { cn } from "@/lib/utils";

/** TMK first-digit → county name */
const ISLANDS = [
  { code: "1", label: "Oahu" },
  { code: "2", label: "Maui" },
  { code: "3", label: "Hawaii" },
  { code: "4", label: "Kauai" },
] as const;

function formatDollar(n: number): string {
  if (n < 0) return `-${formatDollar(-n)}`;
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}bil`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}mil`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return `$${n.toLocaleString()}`;
}

function formatValue(n: number, format: string): string {
  if (format === "dollar") return formatDollar(n);
  if (format === "number") return n.toLocaleString();
  if (format === "year") return String(n);
  return String(n);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s)|^\w{3} \w{3} \d{2} \d{4}/;

/** Format date-like strings as "Wed, Aug 25, 2004", pass others through. */
function displayValue(val: string): string {
  if (DATE_RE.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  return val;
}

function CountCell({ counts, code }: { counts: IslandCounts; code: string }) {
  const n = counts[code] ?? 0;
  return (
    <td className="py-1.5 text-right tabular-nums">
      {n > 0 ? n.toLocaleString() : ""}
    </td>
  );
}

function SortHeader({
  label,
  colKey,
  sortCol,
  onSort,
}: {
  label: string;
  colKey: string;
  sortCol: string;
  onSort: (col: string) => void;
}) {
  const isActive = sortCol === colKey;
  return (
    <th
      className="cursor-pointer select-none pb-2 text-right font-medium hover:text-foreground"
      onClick={() => onSort(colKey)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive && <ArrowDown className="h-3 w-3" />}
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

  const [result, setResult] = useState<SummaryResult | null>(null);
  const [distResult, setDistResult] = useState<SummaryResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sortCol, setSortCol] = useState<string>("total");

  const selectedDef = allDictFields?.find((f) => f.key === selectedField);
  const fieldSupportsView = selectedDef?.summary?.includes(viewType);
  const hasSummary = fieldSupportsView && !selectedDef?.disabled;

  // Reset sort when field changes
  useEffect(() => {
    setSortCol("total");
  }, [selectedField]);

  useEffect(() => {
    if (!selectedField || !hasSummary) {
      setResult(null);
      setDistResult(null);
      return;
    }
    // Only pass sortBy for rank fields (summary sort is client-side)
    const sortBy = viewType === "rank" && sortCol !== "total" ? sortCol : undefined;
    startTransition(async () => {
      const data = await getHhdbSummaries(tableName, selectedField, viewType, sortBy);
      setResult(data);

      // For range view, also fetch distribution
      if (viewType === "range" && selectedDef?.format && selectedDef.format !== "text") {
        const dist = await getHhdbDistribution(tableName, selectedField);
        setDistResult(dist);
      } else {
        setDistResult(null);
      }
    });
  }, [tableName, selectedField, hasSummary, sortCol, viewType, selectedDef?.format]);

  if (!viewFields || viewFields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No fields available for this view.
      </p>
    );
  }

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
            <h3 className="mb-1 text-lg font-semibold">{selectedDef.label}</h3>
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

            {/* Summary results */}
            {hasSummary && !isPending && result && (
              <>
                {result.type === "range" && (() => {
                  const fmt = result.format;
                  const byIsland = (code: string) => result.islands.find((s) => s.island === code);
                  return (
                    <div className="space-y-6">
                      <div className="max-h-[560px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-2 font-medium" />
                              <th className="pb-2 text-right font-medium">Min</th>
                              <th className="pb-2 text-right font-medium">Median</th>
                              <th className="pb-2 text-right font-medium">Max</th>
                              <th className="text-muted-foreground pb-2 text-right font-medium italic">Nulls</th>
                              <th className="pb-2 text-right font-medium">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ISLANDS.map((i) => {
                              const s = byIsland(i.code);
                              return (
                                <tr key={i.code} className="border-b last:border-0">
                                  <td className="py-1.5 font-medium">{i.label}</td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s && s.count > 0 ? formatValue(s.min, fmt) : ""}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s && s.count > 0 ? formatValue(s.median, fmt) : ""}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s && s.count > 0 ? formatValue(s.max, fmt) : ""}
                                  </td>
                                  <td className="text-muted-foreground py-1.5 text-right italic tabular-nums">
                                    {(result.nullCounts[i.code] ?? 0) > 0
                                      ? result.nullCounts[i.code].toLocaleString()
                                      : ""}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums">
                                    {s && s.count > 0 ? s.count.toLocaleString() : ""}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-b last:border-0">
                              <td className="py-1.5 font-semibold">All Islands</td>
                              <td className="py-1.5 text-right font-semibold tabular-nums">
                                {result.overall.count > 0 ? formatValue(result.overall.min, fmt) : ""}
                              </td>
                              <td className="py-1.5 text-right font-semibold tabular-nums">
                                {result.overall.count > 0 ? formatValue(result.overall.median, fmt) : ""}
                              </td>
                              <td className="py-1.5 text-right font-semibold tabular-nums">
                                {result.overall.count > 0 ? formatValue(result.overall.max, fmt) : ""}
                              </td>
                              <td className="text-muted-foreground py-1.5 text-right font-semibold italic tabular-nums">
                                {result.nullTotal > 0 ? result.nullTotal.toLocaleString() : ""}
                              </td>
                              <td className="py-1.5 text-right font-semibold tabular-nums">
                                {result.overall.count > 0 ? result.overall.count.toLocaleString() : ""}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Distribution table below range stats */}
                      {distResult && distResult.type === "distribution" && distResult.buckets.length > 0 && (() => {
                        const sortedBuckets = sortCol !== "total"
                          ? [...distResult.buckets].sort((a, b) => (b.counts[sortCol] ?? 0) - (a.counts[sortCol] ?? 0))
                          : distResult.buckets;
                        return (
                          <div>
                            <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                              Distribution
                            </h4>
                            <div className="max-h-[400px] overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-left">
                                    <th className="pb-2 font-medium">Range</th>
                                    {ISLANDS.map((i) => (
                                      <SortHeader
                                        key={i.code}
                                        label={i.label}
                                        colKey={i.code}
                                        sortCol={sortCol}
                                        onSort={setSortCol}
                                      />
                                    ))}
                                    <SortHeader
                                      label="Total"
                                      colKey="total"
                                      sortCol={sortCol}
                                      onSort={setSortCol}
                                    />
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedBuckets.map((b) => (
                                    <tr key={b.label} className="border-b last:border-0">
                                      <td className="py-1.5">{b.label}</td>
                                      {ISLANDS.map((i) => (
                                        <CountCell
                                          key={i.code}
                                          counts={b.counts}
                                          code={i.code}
                                        />
                                      ))}
                                      <td className="py-1.5 text-right font-medium tabular-nums">
                                        {b.total.toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                  {distResult.nullTotal > 0 && (
                                    <tr className="border-b last:border-0">
                                      <td className="text-muted-foreground py-1.5 italic">NULL</td>
                                      {ISLANDS.map((i) => (
                                        <td
                                          key={i.code}
                                          className="text-muted-foreground py-1.5 text-right italic tabular-nums"
                                        >
                                          {(distResult.nullCounts[i.code] ?? 0) > 0
                                            ? distResult.nullCounts[i.code].toLocaleString()
                                            : ""}
                                        </td>
                                      ))}
                                      <td className="text-muted-foreground py-1.5 text-right font-medium italic tabular-nums">
                                        {distResult.nullTotal.toLocaleString()}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {result.type === "rank" && (
                  <div className="max-h-[560px] overflow-y-auto">
                    <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      Top 20 Most Common Values
                      {sortCol !== "total" && (
                        <span className="ml-1 normal-case">
                          (by {ISLANDS.find((i) => i.code === sortCol)?.label})
                        </span>
                      )}
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="w-8 pb-2 text-right font-medium">#</th>
                          <th className="pb-2 pl-3 font-medium">Value</th>
                          {ISLANDS.map((i) => (
                            <SortHeader
                              key={i.code}
                              label={i.label}
                              colKey={i.code}
                              sortCol={sortCol}
                              onSort={setSortCol}
                            />
                          ))}
                          <SortHeader
                            label="Total"
                            colKey="total"
                            sortCol={sortCol}
                            onSort={setSortCol}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {result.values.map((v, idx) => (
                          <tr key={v.value} className="border-b last:border-0">
                            <td className="text-muted-foreground py-1.5 text-right tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="max-w-32 py-1.5 pl-3 break-words">
                              {displayValue(v.value)}
                            </td>
                            {ISLANDS.map((i) => (
                              <CountCell
                                key={i.code}
                                counts={v.counts}
                                code={i.code}
                              />
                            ))}
                            <td className="py-1.5 text-right font-medium tabular-nums">
                              {v.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {result.nullTotal > 0 && (
                          <tr className="border-b last:border-0">
                            <td className="py-1.5" />
                            <td className="text-muted-foreground py-1.5 pl-3 italic">
                              NULL
                            </td>
                            {ISLANDS.map((i) => (
                              <td
                                key={i.code}
                                className="text-muted-foreground py-1.5 text-right italic tabular-nums"
                              >
                                {(result.nullCounts[i.code] ?? 0) > 0
                                  ? result.nullCounts[i.code].toLocaleString()
                                  : ""}
                              </td>
                            ))}
                            <td className="text-muted-foreground py-1.5 text-right font-medium italic tabular-nums">
                              {result.nullTotal.toLocaleString()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.type === "summary" && (() => {
                  const sortedValues = [...result.values].sort((a, b) =>
                    sortCol !== "total"
                      ? (b.counts[sortCol] ?? 0) - (a.counts[sortCol] ?? 0)
                      : b.total - a.total,
                  );
                  return (
                  <div className="max-h-[560px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">Value</th>
                          {ISLANDS.map((i) => (
                            <SortHeader
                              key={i.code}
                              label={i.label}
                              colKey={i.code}
                              sortCol={sortCol}
                              onSort={setSortCol}
                            />
                          ))}
                          <SortHeader
                            label="Total"
                            colKey="total"
                            sortCol={sortCol}
                            onSort={setSortCol}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedValues.map((v) => (
                          <tr key={v.value} className="border-b last:border-0">
                            <td className="py-1.5">{displayValue(v.value)}</td>
                            {ISLANDS.map((i) => (
                              <CountCell
                                key={i.code}
                                counts={v.counts}
                                code={i.code}
                              />
                            ))}
                            <td className="py-1.5 text-right font-medium tabular-nums">
                              {v.total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {result.nullTotal > 0 && (
                          <tr className="border-b last:border-0">
                            <td className="text-muted-foreground py-1.5 italic">
                              NULL
                            </td>
                            {ISLANDS.map((i) => (
                              <td
                                key={i.code}
                                className="text-muted-foreground py-1.5 text-right italic tabular-nums"
                              >
                                {(result.nullCounts[i.code] ?? 0) > 0
                                  ? result.nullCounts[i.code].toLocaleString()
                                  : ""}
                              </td>
                            ))}
                            <td className="text-muted-foreground py-1.5 text-right font-medium italic tabular-nums">
                              {result.nullTotal.toLocaleString()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
