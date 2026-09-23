"use client";

import { ISLAND_NAMES } from "@catalog/types/hhdb";
import {
  FILTER_OP_LABELS,
  FILTER_OPS_BY_KIND,
  ISLAND_CODES,
  VALUELESS_OPS,
  type FilterOp,
  type FilterSpec,
  type QuerySchema,
  type QuerySpec,
} from "@catalog/utils/hhdb-query-builder/spec";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ColumnSelect } from "./column-select";
import { columnChoices, findColumn, parseRef, refValue } from "./helpers";

interface FilterListProps {
  schema: QuerySchema;
  spec: QuerySpec;
  onChange: (spec: QuerySpec) => void;
}

function asPair(v: FilterSpec["value"]): [string, string] {
  return Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : ["", ""];
}

function asText(v: FilterSpec["value"]): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return "";
}

export function FilterList({ schema, spec, onChange }: FilterListProps) {
  const choices = columnChoices(schema, spec);
  const islandIndex = spec.filters.findIndex((f) => f.op === "island");
  const islands =
    islandIndex >= 0
      ? ([] as string[]).concat(spec.filters[islandIndex].value ?? [])
      : [];
  const rows = spec.filters
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.op !== "island");

  const setFilters = (filters: FilterSpec[]) => onChange({ ...spec, filters });

  const setIslands = (codes: string[]) => {
    const rest = spec.filters.filter((f) => f.op !== "island");
    if (codes.length === 0) return setFilters(rest);
    const sorted = [...codes].sort();
    setFilters([
      { table: spec.primary, column: "tmk", op: "island", value: sorted },
      ...rest,
    ]);
  };

  const update = (i: number, patch: Partial<FilterSpec>) =>
    setFilters(spec.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const remove = (i: number) =>
    setFilters(spec.filters.filter((_, j) => j !== i));

  const add = () => {
    const first = choices.find((c) => c.column.name !== "tmk") ?? choices[0];
    if (!first) return;
    const op = FILTER_OPS_BY_KIND[first.column.kind][0];
    setFilters([
      ...spec.filters,
      { table: first.table.name, column: first.column.name, op, value: "" },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-xs">Island</span>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={islands}
          onValueChange={setIslands}
        >
          {ISLAND_CODES.map((code) => (
            <ToggleGroupItem key={code} value={code} className="px-3 text-xs">
              {ISLAND_NAMES[code]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {islands.length === 0 && (
          <span className="text-muted-foreground text-xs">All islands</span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map(({ f, i }) => {
          const column = findColumn(schema, f.table, f.column);
          const kind = column?.kind ?? "string";
          const ops = FILTER_OPS_BY_KIND[kind];
          const valueless = VALUELESS_OPS.has(f.op);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <ColumnSelect
                choices={choices}
                value={refValue(f.table, f.column)}
                className="min-w-48"
                onChange={(v) => {
                  const ref = parseRef(v);
                  const nextKind =
                    findColumn(schema, ref.table, ref.column)?.kind ?? "string";
                  const nextOps = FILTER_OPS_BY_KIND[nextKind];
                  update(i, {
                    ...ref,
                    op: nextOps.includes(f.op) ? f.op : nextOps[0],
                    value: nextKind === kind ? f.value : "",
                  });
                }}
              />
              <Select
                value={f.op}
                onValueChange={(op) =>
                  update(i, {
                    op: op as FilterOp,
                    value:
                      op === "between"
                        ? ["", ""]
                        : VALUELESS_OPS.has(op as FilterOp)
                          ? undefined
                          : asText(f.value),
                  })
                }
              >
                <SelectTrigger size="sm" className="min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op} value={op}>
                      {FILTER_OP_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!valueless && f.op === "between" && (
                <>
                  <Input
                    type={kind === "date" ? "date" : "number"}
                    className="h-8 w-40"
                    value={asPair(f.value)[0]}
                    onChange={(e) =>
                      update(i, { value: [e.target.value, asPair(f.value)[1]] })
                    }
                  />
                  <span className="text-muted-foreground text-xs">and</span>
                  <Input
                    type={kind === "date" ? "date" : "number"}
                    className="h-8 w-40"
                    value={asPair(f.value)[1]}
                    onChange={(e) =>
                      update(i, { value: [asPair(f.value)[0], e.target.value] })
                    }
                  />
                </>
              )}

              {!valueless &&
                f.op !== "between" &&
                kind === "enum" &&
                f.op !== "in" && (
                  <Select
                    value={asText(f.value)}
                    onValueChange={(v) => update(i, { value: v })}
                  >
                    <SelectTrigger size="sm" className="min-w-36">
                      <SelectValue placeholder="Value" />
                    </SelectTrigger>
                    <SelectContent>
                      {(column?.enumValues ?? []).map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

              {!valueless &&
                f.op !== "between" &&
                !(kind === "enum" && f.op !== "in") && (
                  <Input
                    type={
                      kind === "date"
                        ? "date"
                        : kind === "number" && f.op !== "in"
                          ? "number"
                          : "text"
                    }
                    className="h-8 w-56"
                    placeholder={
                      f.op === "in"
                        ? "Comma-separated values"
                        : kind === "date"
                          ? ""
                          : "Value"
                    }
                    value={asText(f.value)}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                )}

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => remove(i)}
                aria-label="Remove filter"
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={add}
        disabled={choices.length === 0}
      >
        <Plus className="size-4" />
        Add filter
      </Button>
      {rows.length > 1 && (
        <span className="text-muted-foreground ml-3 text-xs">
          All filters must match.
        </span>
      )}
    </div>
  );
}
