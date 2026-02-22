"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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

interface GeoOption {
  handle: string;
  displayName: string | null;
}

interface GeoMultiSelectProps {
  geos: GeoOption[];
  selected: string[];
  onChange: (handles: string[]) => void;
}

export function GeoMultiSelect({
  geos,
  selected,
  onChange,
}: GeoMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selected);

  const toggle = (handle: string) => {
    if (selectedSet.has(handle)) {
      onChange(selected.filter((h) => h !== handle));
    } else {
      onChange([...selected, handle]);
    }
  };

  const label =
    selected.length === 0
      ? "All geos"
      : selected.length <= 3
        ? selected.join(", ")
        : `${selected.length} geos`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[160px] justify-between font-mono text-xs"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search geos..." />
          <CommandList>
            <CommandEmpty>No geographies found.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem value="__clear__" onSelect={() => onChange([])}>
                  <span className="text-muted-foreground text-xs">
                    Clear selection (all geos)
                  </span>
                </CommandItem>
              )}
              {geos.map((g) => (
                <CommandItem
                  key={g.handle}
                  value={`${g.handle} ${g.displayName ?? ""}`}
                  onSelect={() => toggle(g.handle)}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${
                      selectedSet.has(g.handle) ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="font-mono text-xs">{g.handle}</span>
                  {g.displayName && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {g.displayName}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
