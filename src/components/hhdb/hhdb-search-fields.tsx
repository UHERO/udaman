"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HhdbSearchFieldsProps {
  options: { key: string; label: string }[];
  /** Picked field keys. Empty means every field is searched. */
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Picks the columns the search box matches. Changes apply when the menu
 * closes: each change is a LIKE scan, and a query the client abandons keeps
 * running on the server, so one per edit rather than one per checkbox.
 */
export function HhdbSearchFields({
  options,
  value,
  onChange,
}: HhdbSearchFieldsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const current = open ? draft : value;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(value);
      return;
    }
    const changed =
      draft.length !== value.length || draft.some((k) => !value.includes(k));
    if (changed) onChange(draft);
  };

  const toggle = (key: string, checked: boolean) =>
    setDraft((d) =>
      options
        .map((o) => o.key)
        .filter((k) => (k === key ? checked : d.includes(k))),
    );

  const label =
    current.length === 0 || current.length === options.length
      ? "All fields"
      : current.length === 1
        ? options.find((o) => o.key === current[0])?.label
        : `${current.length} fields`;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          {label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Search in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.key}
            checked={draft.includes(o.key)}
            onCheckedChange={(v) => toggle(o.key, !!v)}
            // Stay open so several fields can be picked in one go.
            onSelect={(e) => e.preventDefault()}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={draft.length === options.length}
          onSelect={(e) => {
            e.preventDefault();
            setDraft(options.map((o) => o.key));
          }}
        >
          Select all
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={draft.length === 0}
          onSelect={(e) => {
            e.preventDefault();
            setDraft([]);
          }}
        >
          Reset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
