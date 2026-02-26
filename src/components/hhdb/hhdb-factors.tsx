"use client";

import { useState, useTransition } from "react";
import { getHhdbFactors } from "@/actions/hhdb";
import { HHDB_FIELDS, type FactorResult, type IslandCounts } from "@catalog/types/hhdb";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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

function formatRange(min: string, max: string, format: string): string {
  if (format === "dollar") {
    return `${formatDollar(Number(min))} – ${formatDollar(Number(max))}`;
  }
  if (format === "number") {
    return `${Number(min).toLocaleString()} – ${Number(max).toLocaleString()}`;
  }
  return `${min} – ${max}`;
}

function CountCell({ counts, code }: { counts: IslandCounts; code: string }) {
  const n = counts[code] ?? 0;
  return (
    <td className="py-1.5 text-right tabular-nums">
      {n > 0 ? n.toLocaleString() : ""}
    </td>
  );
}

export function HhdbFactors({ tableName }: { tableName: string }) {
  const fields = HHDB_FIELDS[tableName];
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [result, setResult] = useState<FactorResult | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!fields || fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No factors available for this table.
      </p>
    );
  }

  const handleSelect = (column: string) => {
    setSelectedColumn(column);
    startTransition(async () => {
      const data = await getHhdbFactors(tableName, column);
      setResult(data);
    });
  };

  const selectedField = fields.find((f) => f.column === selectedColumn);

  return (
    <div className="flex gap-6">
      {/* Left panel: field list */}
      <div className="w-48 shrink-0">
        <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Fields
        </h3>
        <div className="max-h-[600px] space-y-0.5 overflow-y-auto">
          {fields.map((f) => (
            <button
              key={f.column}
              onClick={() => handleSelect(f.column)}
              className={cn(
                "w-full rounded px-3 py-1.5 text-left text-sm transition-colors",
                selectedColumn === f.column
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: results */}
      <div className="min-w-0 flex-1">
        {!selectedColumn && (
          <p className="text-muted-foreground pt-8 text-center text-sm">
            Select a field to view its factors.
          </p>
        )}

        {selectedColumn && isPending && (
          <div className="flex items-center justify-center pt-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}

        {selectedColumn && !isPending && result && (
          <div>
            <h3 className="mb-3 text-lg font-semibold">
              {selectedField?.label}
            </h3>

            {result.type === "range" && (
              <p className="text-xl">
                {formatRange(result.min, result.max, result.format)}
              </p>
            )}

            {result.type === "factor" && (
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Value</th>
                      {ISLANDS.map((i) => (
                        <th
                          key={i.code}
                          className="pb-2 text-right font-medium"
                        >
                          {i.label}
                        </th>
                      ))}
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.values.map((v) => (
                      <tr key={v.value} className="border-b last:border-0">
                        <td className="py-1.5">{v.value}</td>
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
                            className="text-muted-foreground py-1.5 text-right tabular-nums italic"
                          >
                            {(result.nullCounts[i.code] ?? 0) > 0
                              ? (result.nullCounts[i.code]).toLocaleString()
                              : ""}
                          </td>
                        ))}
                        <td className="text-muted-foreground py-1.5 text-right font-medium tabular-nums italic">
                          {result.nullTotal.toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
