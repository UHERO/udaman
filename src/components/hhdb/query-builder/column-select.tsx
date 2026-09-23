"use client";

import type { ColumnKind } from "@catalog/utils/hhdb-query-builder/spec";
import { Calendar, Hash, List, ToggleLeft, Type } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ColumnChoice } from "./helpers";

export const KIND_ICONS: Record<ColumnKind, typeof Type> = {
  string: Type,
  number: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  enum: List,
};

interface ColumnSelectProps {
  choices: ColumnChoice[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Narrow the list, e.g. numeric columns only for SUM/AVG. */
  filter?: (choice: ColumnChoice) => boolean;
}

/** A Select of `table.column` values grouped by table, with a kind icon per row. */
export function ColumnSelect({
  choices,
  value,
  onChange,
  placeholder = "Column",
  className,
  filter,
}: ColumnSelectProps) {
  const visible = filter ? choices.filter(filter) : choices;
  const groups = new Map<string, ColumnChoice[]>();
  for (const c of visible) {
    const list = groups.get(c.table.name) ?? [];
    list.push(c);
    groups.set(c.table.name, list);
  }
  const multi = groups.size > 1;

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {[...groups.entries()].map(([name, items]) => (
          <SelectGroup key={name}>
            {multi && <SelectLabel>{items[0].table.title}</SelectLabel>}
            {items.map((c) => {
              const Icon = KIND_ICONS[c.column.kind];
              return (
                <SelectItem key={c.value} value={c.value}>
                  <Icon className="text-muted-foreground size-3.5" />
                  <span>{c.column.label}</span>
                  {multi && (
                    <span className="text-muted-foreground text-xs">
                      {c.table.title}
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
