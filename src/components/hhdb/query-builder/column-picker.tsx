"use client";

import { useState } from "react";
import {
  columnKey,
  selectedTables,
  type QuerySchema,
  type QuerySpec,
} from "@catalog/utils/hhdb-query-builder/spec";
import { Columns3, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { KIND_ICONS } from "./column-select";
import { columnChoices, findTable } from "./helpers";

interface ColumnPickerProps {
  schema: QuerySchema;
  spec: QuerySpec;
  onChange: (spec: QuerySpec) => void;
}

export function ColumnPicker({ schema, spec, onChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const choices = columnChoices(schema, spec);
  const selected = new Set(
    spec.columns.map((c) => columnKey(c.table, c.column)),
  );
  const multi = selectedTables(spec).length > 1;

  const toggle = (table: string, column: string) => {
    const key = columnKey(table, column);
    if (selected.has(key)) {
      onChange({
        ...spec,
        columns: spec.columns.filter(
          (c) => columnKey(c.table, c.column) !== key,
        ),
      });
    } else {
      onChange({ ...spec, columns: [...spec.columns, { table, column }] });
    }
  };

  const setTable = (table: string, on: boolean) => {
    const t = findTable(schema, table);
    if (!t) return;
    const rest = spec.columns.filter((c) => c.table !== table);
    onChange({
      ...spec,
      columns: on
        ? [...rest, ...t.columns.map((c) => ({ table, column: c.name }))]
        : rest,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="size-4" />
              Choose columns
              <span className="text-muted-foreground">
                ({spec.columns.length})
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Search columns…" />
              <CommandList className="max-h-96">
                <CommandEmpty>No column found.</CommandEmpty>
                {selectedTables(spec).map((name) => {
                  const table = findTable(schema, name);
                  if (!table) return null;
                  const items = choices.filter((c) => c.table.name === name);
                  const count = items.filter((c) =>
                    selected.has(columnKey(name, c.column.name)),
                  ).length;
                  return (
                    <CommandGroup
                      key={name}
                      heading={
                        <span className="flex items-center justify-between">
                          <span>{table.title}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground text-xs font-normal"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setTable(name, count < items.length)}
                          >
                            {count < items.length ? "Select all" : "Clear"}
                          </button>
                        </span>
                      }
                    >
                      {items.map((c) => {
                        const on = selected.has(columnKey(name, c.column.name));
                        const Icon = KIND_ICONS[c.column.kind];
                        return (
                          <CommandItem
                            key={c.value}
                            value={`${table.title} ${c.column.label} ${c.column.name}`}
                            onSelect={() => toggle(name, c.column.name)}
                          >
                            <Checkbox
                              checked={on}
                              className="pointer-events-none"
                              tabIndex={-1}
                            />
                            <Icon className="text-muted-foreground size-3.5" />
                            <span className="flex-1 truncate">
                              {c.column.label}
                            </span>
                            <span className="text-muted-foreground truncate font-mono text-[10px]">
                              {c.column.name}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {spec.columns.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange({ ...spec, columns: [] })}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {spec.columns.length === 0 && (
          <span className="text-muted-foreground text-xs">
            No columns chosen; the first columns of the primary table will be
            returned.
          </span>
        )}
        {spec.columns.map((c) => {
          const table = findTable(schema, c.table);
          const col = table?.columns.find((x) => x.name === c.column);
          return (
            <Badge
              key={columnKey(c.table, c.column)}
              variant="outline"
              className="h-6 gap-1 pr-1 font-normal"
            >
              {multi && (
                <span className="text-muted-foreground text-[10px]">
                  {table?.title}
                </span>
              )}
              {col?.label ?? c.column}
              <button
                type="button"
                onClick={() => toggle(c.table, c.column)}
                className="hover:bg-muted rounded-sm p-0.5"
                aria-label={`Remove ${col?.label ?? c.column}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
