"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { DATE_INPUT_PLACEHOLDER, parseDateInput } from "../../lib/dates";
import type { DateEntry, DateRange, FreqCode } from "../../lib/types";

export type DateRangeChange = DateRange & {
  startIndex: number;
  endIndex: number;
};

/**
 * Date range control (port of date-slider): [start input] ——slider—— [end input].
 *
 * Props-driven: the caller resolves the current range (resolveDateRange) and
 * decides what a change means — usually
 *   setParams(rangeToParams(range), { mode: "shallow" }).
 *
 * - The slider spans every period in `dates`; dragging updates the inputs live
 *   and emits once on release (Angular onSlideEnd).
 * - Inputs accept the frequency's format (DATE_INPUT_PLACEHOLDER: "YYYY",
 *   "YYYY Q#", "YYYY-MM", "YYYY-MM-DD"); only dates on the grid are accepted
 *   (Angular checkValidCalendarInput); invalid input reverts on blur.
 * - Emitted ranges are never the default range (useDefaultRange=false) and
 *   endOfSample is true when the end handle is on the last period.
 */
export function DateRangeSlider({
  dates,
  freq,
  startIndex,
  endIndex,
  onChange,
  className,
}: {
  dates: DateEntry[];
  freq: FreqCode;
  startIndex: number;
  endIndex: number;
  onChange: (range: DateRangeChange) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const [s, e] = draft ?? [startIndex, endIndex];
  const last = dates.length - 1;

  if (last < 0) return null;

  const emit = (a: number, b: number) => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(last, Math.max(a, b));
    setDraft(null);
    if (lo === startIndex && hi === endIndex) return;
    onChange({
      startDate: dates[lo].date,
      endDate: dates[hi].date,
      useDefaultRange: false,
      endOfSample: hi === last,
      startIndex: lo,
      endIndex: hi,
    });
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <DateInput
        key={`s-${dates[s]?.date}-${freq}`}
        label="Start date"
        freq={freq}
        entry={dates[s]}
        dates={dates}
        onCommit={(i) => emit(i, e)}
      />
      <Slider
        min={0}
        max={last}
        step={1}
        minStepsBetweenThumbs={0}
        value={[s, e]}
        onValueChange={(v) => setDraft([v[0], v[1]])}
        onValueCommit={(v) => emit(v[0], v[1])}
        aria-label="Date range"
        className="min-w-24 flex-1 **:data-[slot=slider-range]:bg-(--portal-primary) **:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:rounded-none **:data-[slot=slider-thumb]:border-(--portal-primary) **:data-[slot=slider-track]:h-1 **:data-[slot=slider-track]:rounded-none"
      />
      <DateInput
        key={`e-${dates[e]?.date}-${freq}`}
        label="End date"
        freq={freq}
        entry={dates[e]}
        dates={dates}
        onCommit={(i) => emit(s, i)}
      />
    </div>
  );
}

/** Text input for one end of the range. Remounted (key) when the value changes. */
function DateInput({
  label,
  freq,
  entry,
  dates,
  onCommit,
}: {
  label: string;
  freq: FreqCode;
  entry: DateEntry | undefined;
  dates: DateEntry[];
  onCommit: (index: number) => void;
}) {
  const initial = entry?.tableDate ?? "";
  const [text, setText] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    if (text === initial) return setInvalid(false);
    const date = parseDateInput(text, freq);
    const index = date ? dates.findIndex((d) => d.date === date) : -1;
    if (index < 0) {
      setText(initial);
      setInvalid(false);
      return;
    }
    setInvalid(false);
    onCommit(index);
  };

  return (
    <Input
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={text}
      placeholder={DATE_INPUT_PLACEHOLDER[freq]}
      onChange={(ev) => {
        const v = ev.target.value;
        setText(v);
        const date = parseDateInput(v, freq);
        setInvalid(!!v && (!date || !dates.some((d) => d.date === date)));
      }}
      onBlur={commit}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") commit();
        if (ev.key === "Escape") {
          setText(initial);
          setInvalid(false);
        }
      }}
      className={cn(
        "h-8 rounded-none bg-white px-2 text-center text-sm tabular-nums shadow-none",
        freq === "W" || freq === "D" ? "w-28" : "w-20",
      )}
    />
  );
}
