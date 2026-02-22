"use client";

import type { Adjustment } from "@catalog/controllers/compare-filters";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { GeoMultiSelect } from "./geo-multi-select";
import {
  ADJUSTMENT_OPTIONS,
  ALL_FREQUENCY_OPTIONS,
  UNIVERSES,
  type FilterRowState,
} from "./parse-filter-names";

interface FilterRowControlsProps {
  row: FilterRowState;
  geos: { handle: string; displayName: string | null }[];
  freqOptions: { value: string; label: string }[];
  onUpdate: (updates: Partial<FilterRowState>) => void;
  onRemove: () => void;
  onUniverseChange: (universe: string) => void;
  error?: boolean;
}

export function FilterRowControls({
  row,
  geos,
  freqOptions,
  onUpdate,
  onRemove,
  onUniverseChange,
  error,
}: FilterRowControlsProps) {
  return (
    <>
      <GeoMultiSelect
        geos={geos}
        selected={row.geos}
        onChange={(geos) => onUpdate({ geos })}
      />
      <Select
        value={
          freqOptions.some((f) => f.value === row.frequency)
            ? row.frequency
            : undefined
        }
        onValueChange={(v) => onUpdate({ frequency: v })}
      >
        <SelectTrigger className="w-[70px] text-xs">
          <SelectValue placeholder="Freq" />
        </SelectTrigger>
        <SelectContent>
          {freqOptions.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={row.adjustment}
        onValueChange={(v) => onUpdate({ adjustment: v as Adjustment })}
      >
        <SelectTrigger className="w-[70px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ADJUSTMENT_OPTIONS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={row.universe}
        onValueChange={(v) => {
          onUpdate({ universe: v });
          onUniverseChange(v);
        }}
      >
        <SelectTrigger className="w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNIVERSES.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
