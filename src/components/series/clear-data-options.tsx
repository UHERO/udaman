"use client";

import type { DeleteByMode } from "@catalog/collections/series-collection";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type ClearModeOption = {
  value: DeleteByMode;
  label: string;
  description: string;
  needsDate: boolean;
};

/** The clear-data modes offered by the Series Data Loader and the clipboard. */
export const CLEAR_MODES: ClearModeOption[] = [
  {
    value: "none",
    label: "All",
    description: "Clear all data points",
    needsDate: false,
  },
  {
    value: "observationDate",
    label: "After date",
    description: "Delete points on or after date",
    needsDate: true,
  },
  {
    value: "beforeObservationDate",
    label: "Before date",
    description: "Delete points on or before date",
    needsDate: true,
  },
  {
    value: "currentOnly",
    label: "Current only",
    description: "Delete only current points (preserves vintages)",
    needsDate: false,
  },
  {
    value: "vintageDate",
    label: "After vintage",
    description: "Delete points loaded after date",
    needsDate: true,
  },
];

export function clearModeNeedsDate(deleteBy: DeleteByMode): boolean {
  return CLEAR_MODES.find((m) => m.value === deleteBy)?.needsDate ?? false;
}

export function clearModeLabel(deleteBy: DeleteByMode): string {
  return CLEAR_MODES.find((m) => m.value === deleteBy)?.label ?? deleteBy;
}

/**
 * Radio group of clear modes plus the (conditionally enabled) date input.
 * Shared by the series/loader ClearDataDialog and the clipboard bulk dialog.
 */
export function ClearDataOptions({
  deleteBy,
  onDeleteByChange,
  date,
  onDateChange,
  idPrefix,
}: {
  deleteBy: DeleteByMode;
  onDeleteByChange: (mode: DeleteByMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  /** Unique prefix for input ids when multiple dialogs are mounted on a page */
  idPrefix: string;
}) {
  const needsDate = clearModeNeedsDate(deleteBy);
  return (
    <>
      <RadioGroup
        value={deleteBy}
        onValueChange={(v) => onDeleteByChange(v as DeleteByMode)}
        className="gap-3"
      >
        {CLEAR_MODES.map((mode) => (
          <div key={mode.value} className="flex items-start gap-2">
            <RadioGroupItem
              value={mode.value}
              id={`clear-${idPrefix}-${mode.value}`}
              className="mt-0.5"
            />
            <Label
              htmlFor={`clear-${idPrefix}-${mode.value}`}
              className="cursor-pointer leading-tight font-normal"
            >
              <span className="font-semibold">{mode.label}</span>
              <span className="text-muted-foreground ml-1 text-xs">
                {mode.description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      <div
        className={cn(
          "transition-opacity",
          needsDate ? "opacity-100" : "pointer-events-none opacity-30",
        )}
      >
        <Label htmlFor={`clear-date-${idPrefix}`} className="text-xs">
          Date <span className="text-muted-foreground">(YYYY-MM-DD)</span>
        </Label>
        <Input
          id={`clear-date-${idPrefix}`}
          placeholder="YYYY-MM-DD"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={!needsDate}
          className="mt-1"
        />
      </div>
    </>
  );
}
