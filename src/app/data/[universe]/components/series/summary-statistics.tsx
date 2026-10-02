"use client";

import { cn } from "@/lib/utils";

import type { SummaryStats } from "../../lib/types";

/**
 * Summary statistics over the selected range (summary-statistics.component):
 * Min, Max, % Change (not for percent series), Change, plus CAGR for
 * non-percent series. Laid out as a single classic stats row.
 */
export function SummaryStatistics({
  stats,
  unitsShort,
  percent,
  className,
}: {
  stats: SummaryStats;
  unitsShort?: string;
  percent?: boolean;
  className?: string;
}) {
  const units = unitsShort ? ` ${unitsShort}` : "";
  const splitDate = (v: string) => {
    // calculateSummaryStats formats min/max as "1,234.5 (2019 Q3)".
    const m = v.match(/^(.*) \((.*)\)$/);
    return m ? { value: m[1], date: m[2] } : { value: v, date: "" };
  };
  const min = splitDate(stats.minValue);
  const max = splitDate(stats.maxValue);

  const cells: { label: string; value: string; note?: string }[] = [
    {
      label: "Minimum",
      value: min.value,
      note: [min.date, unitsShort].filter(Boolean).join(" · "),
    },
    {
      label: "Maximum",
      value: max.value,
      note: [max.date, unitsShort].filter(Boolean).join(" · "),
    },
    ...(!percent && stats.percChange !== null
      ? [{ label: "% Change", value: stats.percChange, note: "over range" }]
      : []),
    {
      label: "Change",
      value: stats.levelChange,
      note: `over range${units ? ` ·${units}` : ""}`,
    },
    ...(!percent
      ? [{ label: "CAGR", value: stats.cagr, note: "% per year" }]
      : []),
  ];

  return (
    <div className={className}>
      <dl
        className={cn(
          "border-foreground/80 grid grid-cols-2 border-t-2 border-b-2 sm:grid-cols-3",
          cells.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        {cells.map((c) => (
          <div
            key={c.label}
            className="border-border/70 border-b px-3 py-2.5 sm:border-r sm:last:border-r-0 lg:border-b-0"
          >
            <dt className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              {c.label}
            </dt>
            <dd className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
              {c.value || "N/A"}
            </dd>
            {c.note && (
              <dd className="text-muted-foreground text-xs">{c.note}</dd>
            )}
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground mt-2 text-xs">
        Selected range: {stats.range}
        {stats.missing &&
          " · Some statistics are unavailable because the selected range starts or ends on a period with no observation."}
      </p>
    </div>
  );
}
