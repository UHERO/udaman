"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { searchPrefixesAction } from "@/actions/compare-filters";
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

interface MeasurementOption {
  id: number;
  prefix: string;
  dataPortalName: string | null;
}

interface UnifiedPrefixComboboxProps {
  measurements: MeasurementOption[];
  value: string;
  measurementId: number | null;
  universe: string;
  onSelect: (
    prefix: string,
    mode: "measurement" | "search",
    measurementId: number | null,
  ) => void;
}

export function UnifiedPrefixCombobox({
  measurements,
  value,
  measurementId,
  universe,
  onSelect,
}: UnifiedPrefixComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [seriesPrefixes, setSeriesPrefixes] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. URL hydration)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Client-side filter measurements
  const filteredMeasurements = measurements
    .filter((m) => {
      if (!inputValue) return true;
      const q = inputValue.toLowerCase();
      return (
        m.prefix.toLowerCase().includes(q) ||
        m.dataPortalName?.toLowerCase().includes(q)
      );
    })
    .slice(0, 50);

  // Deduplicate: hide series prefixes that already appear as a measurement
  const measurementPrefixSet = new Set(
    filteredMeasurements.map((m) => m.prefix.toUpperCase()),
  );
  const uniqueSeriesPrefixes = seriesPrefixes.filter(
    (p) => !measurementPrefixSet.has(p.toUpperCase()),
  );

  const selectedMeasurement = measurementId
    ? measurements.find((m) => m.id === measurementId)
    : null;

  const doSearch = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) {
      setSeriesPrefixes([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const prefixes = await searchPrefixesAction(text, universe);
        setSeriesPrefixes(prefixes);
      } catch {
        setSeriesPrefixes([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasResults =
    filteredMeasurements.length > 0 || uniqueSeriesPrefixes.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between font-mono text-xs"
        >
          <span className="truncate">{value || "Select prefix..."}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search measurements & series..."
            value={inputValue}
            onValueChange={(v) => {
              setInputValue(v);
              doSearch(v);
            }}
          />
          <CommandList>
            {!hasResults && !isSearching && (
              <CommandEmpty>
                {inputValue.length < 1
                  ? "Type to search..."
                  : "No matching prefixes found."}
              </CommandEmpty>
            )}
            {!hasResults && isSearching && (
              <CommandEmpty>
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-muted-foreground text-sm">
                    Searching...
                  </span>
                </div>
              </CommandEmpty>
            )}
            {filteredMeasurements.length > 0 && (
              <CommandGroup heading="Measurements">
                {filteredMeasurements.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`measurement-${m.id}`}
                    onSelect={() => {
                      onSelect(m.prefix, "measurement", m.id);
                      setInputValue(m.prefix);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-3.5 w-3.5 ${
                        selectedMeasurement?.id === m.id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <span className="font-mono text-xs">{m.prefix}</span>
                    {m.dataPortalName && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {m.dataPortalName}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {uniqueSeriesPrefixes.length > 0 && (
              <CommandGroup heading="Series">
                {uniqueSeriesPrefixes.map((prefix) => (
                  <CommandItem
                    key={prefix}
                    value={`series-${prefix}`}
                    onSelect={() => {
                      onSelect(prefix, "search", null);
                      setInputValue(prefix);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-3.5 w-3.5 ${
                        value === prefix && !measurementId
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <span className="font-mono text-xs">{prefix}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {isSearching && hasResults && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Searching series...</span>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
