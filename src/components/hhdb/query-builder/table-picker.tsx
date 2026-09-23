"use client";

import { useState } from "react";
import type {
  QuerySchema,
  QuerySpec,
  TableMeta,
} from "@catalog/utils/hhdb-query-builder/spec";
import { AlertTriangle, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  defaultColumnsFor,
  fanOutCount,
  findTable,
  pruneSpec,
} from "./helpers";

interface TablePickerProps {
  schema: QuerySchema;
  spec: QuerySpec;
  onChange: (spec: QuerySpec) => void;
}

function groupTables(tables: TableMeta[]): [string, TableMeta[]][] {
  const groups = new Map<string, TableMeta[]>();
  for (const t of tables) {
    const list = groups.get(t.group) ?? [];
    list.push(t);
    groups.set(t.group, list);
  }
  return [...groups.entries()];
}

export function TablePicker({ schema, spec, onChange }: TablePickerProps) {
  const [open, setOpen] = useState(false);
  const primary = findTable(schema, spec.primary);
  const joinable = schema.tables.filter(
    (t) => t.name !== spec.primary && !spec.tables.includes(t.name),
  );
  const fanOut = fanOutCount(spec, schema);
  const large = [spec.primary, ...spec.tables]
    .map((t) => findTable(schema, t))
    .filter((t): t is TableMeta => !!t?.large);

  const setPrimary = (name: string) => {
    const table = findTable(schema, name);
    if (!table) return;
    onChange(
      pruneSpec(
        {
          ...spec,
          primary: name,
          tables: spec.tables.filter((t) => t !== name),
          columns: defaultColumnsFor(table),
        },
        schema,
      ),
    );
  };

  const addTable = (name: string) => {
    setOpen(false);
    onChange({ ...spec, tables: [...spec.tables, name] });
  };

  const removeTable = (name: string) => {
    onChange(
      pruneSpec(
        { ...spec, tables: spec.tables.filter((t) => t !== name) },
        schema,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={spec.primary} onValueChange={setPrimary}>
          <SelectTrigger size="sm" className="min-w-52">
            <SelectValue placeholder="Primary table" />
          </SelectTrigger>
          <SelectContent>
            {groupTables(schema.tables).map(([group, tables]) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {tables.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {spec.tables.map((name) => {
          const t = findTable(schema, name);
          return (
            <Badge
              key={name}
              variant="secondary"
              className="h-7 gap-1 pr-1 pl-2.5 text-sm"
            >
              <span className="text-muted-foreground text-xs">+</span>
              {t?.title ?? name}
              <button
                type="button"
                onClick={() => removeTable(name)}
                className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm p-0.5"
                aria-label={`Remove ${t?.title ?? name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={joinable.length === 0}
            >
              <Plus className="size-4" />
              Join table
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search tables…" />
              <CommandList>
                <CommandEmpty>No table found.</CommandEmpty>
                {groupTables(joinable).map(([group, tables]) => (
                  <CommandGroup key={group} heading={group}>
                    {tables.map((t) => (
                      <CommandItem
                        key={t.name}
                        value={`${t.title} ${t.name}`}
                        onSelect={() => addTable(t.name)}
                      >
                        <span className="flex-1">{t.title}</span>
                        {t.onePerTmk ? (
                          <span className="text-muted-foreground text-xs">
                            1 per TMK
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            many per TMK
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {primary?.docs && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-muted-foreground line-clamp-2 max-w-3xl cursor-help text-xs">
              {primary.docs}
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md text-xs">
            {primary.docs}
          </TooltipContent>
        </Tooltip>
      )}

      {spec.tables.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Joined tables are matched to{" "}
          <span className="font-medium">{primary?.title}</span> on TMK. Rows
          from the primary table with no match keep their columns; the joined
          columns come back empty.
        </p>
      )}

      {fanOut >= 2 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            You have combined {fanOut} tables that each can have several rows
            per TMK. Every combination is returned, so a parcel with 3 sales and
            5 assessments yields 15 rows. Filter one of them down (for example a
            single year) or switch on Summarize.
          </span>
        </div>
      )}

      {large.length > 0 && spec.filters.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {large.map((t) => t.title).join(", ")}{" "}
            {large.length > 1 ? "have" : "has"} millions of rows. Add a filter
            on island, year or TMK so the query finishes within the 30 s limit.
          </span>
        </div>
      )}
    </div>
  );
}
