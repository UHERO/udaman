"use client";

import {
  AGGREGATE_FNS,
  AGGREGATE_LABELS,
  DATE_BUCKETS,
  NUMERIC_ONLY_FNS,
  type AggregateFn,
  type DateBucket,
  type QuerySchema,
  type QuerySpec,
} from "@catalog/utils/hhdb-query-builder/spec";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { ColumnSelect } from "./column-select";
import { columnChoices, findColumn, parseRef, refValue } from "./helpers";

interface SummarizePanelProps {
  schema: QuerySchema;
  spec: QuerySpec;
  onChange: (spec: QuerySpec) => void;
}

export function SummarizePanel({
  schema,
  spec,
  onChange,
}: SummarizePanelProps) {
  const choices = columnChoices(schema, spec);
  const { enabled, groupBy, aggregates } = spec.summarize;

  const set = (patch: Partial<QuerySpec["summarize"]>) =>
    onChange({ ...spec, summarize: { ...spec.summarize, ...patch } });

  const toggle = (on: boolean) => {
    const next = { ...spec, summarize: { ...spec.summarize, enabled: on } };
    if (on && aggregates.length === 0)
      next.summarize.aggregates = [{ fn: "count" }];
    // Sort keys differ between modes; let the user pick again.
    delete next.sort;
    onChange(next);
  };

  const addGroup = () => {
    const first =
      choices.find((c) => c.column.name === "island_code") ??
      choices.find(
        (c) => c.column.kind !== "number" && c.column.name !== "tmk",
      ) ??
      choices[0];
    if (!first) return;
    set({
      groupBy: [
        ...groupBy,
        { table: first.table.name, column: first.column.name },
      ],
    });
  };

  const addAggregate = () => {
    const first = choices.find(
      (c) => c.column.kind === "number" && c.column.name !== "id",
    );
    set({
      aggregates: [
        ...aggregates,
        first
          ? { fn: "sum", table: first.table.name, column: first.column.name }
          : { fn: "count" },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch id="qb-summarize" checked={enabled} onCheckedChange={toggle} />
        <Label htmlFor="qb-summarize" className="cursor-pointer">
          Summarize
        </Label>
        <span className="text-muted-foreground text-xs">
          Group rows and return counts, sums and averages instead of individual
          rows.
        </span>
      </div>

      {enabled && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-medium">Group by</div>
            {groupBy.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No grouping: one row with totals across everything that matches.
              </p>
            )}
            {groupBy.map((g, i) => {
              const kind = findColumn(schema, g.table, g.column)?.kind;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <ColumnSelect
                    choices={choices}
                    value={refValue(g.table, g.column)}
                    className="min-w-48"
                    onChange={(v) => {
                      const ref = parseRef(v);
                      const nextKind = findColumn(
                        schema,
                        ref.table,
                        ref.column,
                      )?.kind;
                      set({
                        groupBy: groupBy.map((x, j) =>
                          j === i
                            ? {
                                ...ref,
                                bucket:
                                  nextKind === "date"
                                    ? (x.bucket ?? "year")
                                    : undefined,
                              }
                            : x,
                        ),
                      });
                    }}
                  />
                  {kind === "date" && (
                    <Select
                      value={g.bucket ?? "year"}
                      onValueChange={(b) =>
                        set({
                          groupBy: groupBy.map((x, j) =>
                            j === i ? { ...x, bucket: b as DateBucket } : x,
                          ),
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_BUCKETS.map((b) => (
                          <SelectItem key={b} value={b}>
                            by {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Remove group"
                    onClick={() =>
                      set({ groupBy: groupBy.filter((_, j) => j !== i) })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={addGroup}
              disabled={groupBy.length >= 8}
            >
              <Plus className="size-4" />
              Add group
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium">Calculate</div>
            {aggregates.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  value={a.fn}
                  onValueChange={(fn) =>
                    set({
                      aggregates: aggregates.map((x, j) =>
                        j === i ? { ...x, fn: fn as AggregateFn } : x,
                      ),
                    })
                  }
                >
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATE_FNS.map((fn) => (
                      <SelectItem key={fn} value={fn}>
                        {AGGREGATE_LABELS[fn]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {a.fn !== "count" && (
                  <ColumnSelect
                    choices={choices}
                    value={
                      a.table && a.column
                        ? refValue(a.table, a.column)
                        : undefined
                    }
                    className="min-w-48"
                    filter={(c) =>
                      !NUMERIC_ONLY_FNS.has(a.fn) || c.column.kind === "number"
                    }
                    onChange={(v) =>
                      set({
                        aggregates: aggregates.map((x, j) =>
                          j === i ? { ...x, ...parseRef(v) } : x,
                        ),
                      })
                    }
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Remove calculation"
                  disabled={aggregates.length <= 1}
                  onClick={() =>
                    set({ aggregates: aggregates.filter((_, j) => j !== i) })
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addAggregate}
              disabled={aggregates.length >= 12}
            >
              <Plus className="size-4" />
              Add calculation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
