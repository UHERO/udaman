"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { PortalConfig } from "../../lib/config";
import type { FreqCode } from "../../lib/types";

export type DisplayTransform = "level" | "yoy" | "ytd" | "c5ma";
export type TableTransform = Exclude<DisplayTransform, "level">;

const OPTION_META: Record<DisplayTransform, { short: string; full: string }> = {
  level: { short: "Level", full: "Level" },
  yoy: { short: "YOY", full: "Year-over-Year % Change" },
  ytd: { short: "YTD", full: "Year-to-Date % Change" },
  c5ma: {
    short: "C5MA",
    full: "Annual % Change (centered 5-year moving average)",
  },
};

/**
 * Transformations this universe offers at this frequency, in display order.
 * YTD is meaningless at annual frequency (it equals YOY), as in Angular.
 */
export function availableTransforms(
  transformations: PortalConfig["transformations"],
  freq: FreqCode,
): TableTransform[] {
  const out: TableTransform[] = [];
  if (transformations.yoy) out.push("yoy");
  if (transformations.ytd && freq !== "A") out.push("ytd");
  if (transformations.c5ma) out.push("c5ma");
  return out;
}

/** Parse the `transform` URL param against what's available (else level). */
export function resolveDisplayTransform(
  value: string | null | undefined,
  available: TableTransform[],
): DisplayTransform {
  return available.includes(value as TableTransform)
    ? (value as TableTransform)
    : "level";
}

type SegmentProps<T extends string> = {
  options: T[];
  className?: string;
} & (
  | { mode: "single"; value: T; onChange: (value: T) => void }
  | { mode: "multiple"; value: T[]; onChange: (value: T[]) => void }
);

/**
 * Segmented toggle matching the Chart/Table view toggle. Chart view uses
 * `mode="single"` (Level | YOY | YTD); table view uses `mode="multiple"` to
 * add transformation rows. Acronym labels, full names in a tooltip.
 */
export function TransformToggle<T extends DisplayTransform>(
  props: SegmentProps<T>,
) {
  const { options, className } = props;
  if (options.length < 2 && props.mode === "single") return null;
  if (!options.length) return null;

  const isOn = (o: T) =>
    props.mode === "single" ? props.value === o : props.value.includes(o);

  const toggle = (o: T) => {
    if (props.mode === "single") {
      if (props.value !== o) props.onChange(o);
    } else {
      props.onChange(
        props.value.includes(o)
          ? props.value.filter((v) => v !== o)
          : // Keep display order stable regardless of click order.
            options.filter((v) => v === o || props.value.includes(v)),
      );
    }
  };

  return (
    <div
      role="group"
      aria-label={
        props.mode === "single" ? "Chart values" : "Table transformations"
      }
      className={cn("border-input flex divide-x border", className)}
    >
      {options.map((o) => (
        <Tooltip key={o}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={isOn(o)}
              aria-label={OPTION_META[o].full}
              onClick={() => toggle(o)}
              className={cn(
                "flex h-8 items-center px-3 text-sm tabular-nums transition-colors",
                isOn(o)
                  ? "bg-(--portal-primary) text-white"
                  : "text-muted-foreground hover:text-foreground bg-white",
              )}
            >
              {OPTION_META[o].short}
            </button>
          </TooltipTrigger>
          <TooltipContent>{OPTION_META[o].full}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
