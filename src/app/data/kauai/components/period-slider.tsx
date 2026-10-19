"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { DateEntry } from "@/app/data/[universe]/lib/types";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * Single-date slider (old time-slice slider): ‹ ──●── › with the selected
 * period labelled. Drags update the label live and commit on release; the
 * arrow buttons step one period.
 */
export function PeriodSlider({
  dates,
  min,
  max,
  value,
  onChange,
  label = "Period",
  className,
}: {
  dates: DateEntry[];
  min: number;
  max: number;
  value: number;
  onChange: (index: number) => void;
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const v = draft ?? value;
  if (max < min) return null;

  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) onChange(next);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-muted-foreground shrink-0 text-[11px] tracking-wider uppercase">
        {label}
      </span>
      <button
        type="button"
        aria-label="Previous period"
        disabled={value <= min}
        onClick={() => step(-1)}
        className="text-muted-foreground hover:text-foreground border-input flex size-7 shrink-0 items-center justify-center border bg-white disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[v]}
        onValueChange={([x]) => setDraft(x)}
        onValueCommit={([x]) => {
          setDraft(null);
          if (x !== value) onChange(x);
        }}
        aria-label={label}
        className="min-w-16 flex-1 **:data-[slot=slider-range]:bg-(--portal-primary) **:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:rounded-none **:data-[slot=slider-thumb]:border-(--portal-primary) **:data-[slot=slider-track]:h-1 **:data-[slot=slider-track]:rounded-none"
      />
      <button
        type="button"
        aria-label="Next period"
        disabled={value >= max}
        onClick={() => step(1)}
        className="text-muted-foreground hover:text-foreground border-input flex size-7 shrink-0 items-center justify-center border bg-white disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="text-foreground w-16 shrink-0 text-right text-sm font-medium tabular-nums">
        {dates[v]?.tableDate}
      </span>
    </div>
  );
}
