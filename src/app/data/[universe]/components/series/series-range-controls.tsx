"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  DATE_INPUT_PLACEHOLDER,
  lowerBound,
  parseDateInput,
  upperBound,
} from "../../lib/dates";
import type { DateEntry, FreqCode } from "../../lib/types";
import { presetRange, rangePresets } from "./series-labels";

/**
 * Chart toolbar: Highstock range-selector buttons ("Zoom 1Y 5Y 10Y All",
 * per config.seriesChart.rangeButtons; no 1Y for annual) and From/To inputs
 * (Highstock's input boxes / the date slider's calendar inputs).
 */
export function SeriesRangeControls({
  dates,
  freq,
  buttons,
  startIndex,
  endIndex,
  onChange,
  className,
}: {
  dates: DateEntry[];
  freq: FreqCode;
  buttons: readonly (number | "all")[];
  startIndex: number;
  endIndex: number;
  onChange: (startIndex: number, endIndex: number) => void;
  className?: string;
}) {
  const presets = rangePresets(buttons, freq);
  const last = dates.length - 1;
  const active = presets.find((p) => {
    const r = presetRange(dates, endIndex, p.years);
    return r.startIndex === startIndex && r.endIndex === endIndex;
  })?.key;

  const commitStart = (value: string) => {
    const d = parseDateInput(value, freq);
    if (!d) return false;
    const i = Math.min(
      lowerBound(
        dates.map((x) => x.date),
        d,
      ),
      last,
    );
    onChange(Math.min(i, endIndex), endIndex);
    return true;
  };
  const commitEnd = (value: string) => {
    const d = parseDateInput(value, freq);
    if (!d) return false;
    const i = Math.max(
      upperBound(
        dates.map((x) => x.date),
        d,
      ),
      0,
    );
    onChange(Math.min(startIndex, i), i);
    return true;
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2",
        className,
      )}
    >
      {presets.length > 0 ? (
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <span className="text-muted-foreground mr-1 text-[11px] font-semibold tracking-wider uppercase">
            Zoom
          </span>
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={active === p.key}
              onClick={() => {
                const r = presetRange(dates, endIndex, p.years);
                onChange(r.startIndex, r.endIndex);
              }}
              className={cn(
                "h-7 min-w-9 border px-2 text-xs tabular-nums transition-colors",
                active === p.key
                  ? "border-foreground/70 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2 text-xs">
        <DateField
          label="From"
          freq={freq}
          value={dates[startIndex]?.tableDate ?? ""}
          onCommit={commitStart}
        />
        <DateField
          label="To"
          freq={freq}
          value={dates[endIndex]?.tableDate ?? ""}
          onCommit={commitEnd}
        />
      </div>
    </div>
  );
}

function DateField({
  label,
  freq,
  value,
  onCommit,
}: {
  label: string;
  freq: FreqCode;
  value: string;
  onCommit: (value: string) => boolean;
}) {
  // Draft text while editing; resets whenever the committed value changes.
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(
    null,
  );
  const text = draft && draft.base === value ? draft.text : value;
  const invalid =
    draft !== null && draft.base === value && draft.text !== value
      ? parseDateInput(draft.text, freq) === null
      : false;

  const commit = () => {
    if (!draft || draft.base !== value || draft.text === value) return;
    if (onCommit(draft.text)) setDraft(null);
  };

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Input
        value={text}
        placeholder={DATE_INPUT_PLACEHOLDER[freq]}
        aria-invalid={invalid || undefined}
        onChange={(e) => setDraft({ base: value, text: e.target.value })}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        className="h-7 w-28 px-2 text-xs tabular-nums shadow-none"
      />
    </label>
  );
}
