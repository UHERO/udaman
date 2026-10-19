"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { DateEntry, FreqCode } from "@/app/data/[universe]/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { Category, SeriesNode } from "../lib/categories";
import type { DashboardSeries } from "../lib/data";
import {
  ACCENT,
  changeColor,
  formatChange,
  formatLevel,
  latestChange,
  unitsText,
} from "../lib/theme";
import { Sparkline } from "./sparkline";

export const TABLE_PERIODS = 5;

/**
 * Indicator table (old data_table): collapsible groups, one row per series
 * with nested children (parents collapse), each row showing
 *   label + units · sparkline over the chart window · Compare checkbox ·
 *   latest value in the window (date, YTD / YoY change) ·
 *   five periods ending at the selected date (value + YoY change).
 * Clicking a row charts it; the checkbox adds it as the comparison series.
 */
export function IndicatorTable({
  category,
  series,
  dates,
  freq,
  lo,
  hi,
  selected,
  primary,
  compare,
  onSelect,
  onCompare,
}: {
  category: Category;
  series: Record<string, DashboardSeries | null>;
  dates: DateEntry[];
  freq: FreqCode;
  lo: number;
  hi: number;
  selected: number;
  primary: string;
  compare: string | null;
  onSelect: (name: string) => void;
  onCompare: (name: string | null) => void;
}) {
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  // Parents below the top level start collapsed (the old table never showed
  // grandchildren; they're one click away now).
  const [openRows, setOpenRows] = useState<Set<string>>(() => {
    const open = new Set<string>();
    category.groups.forEach((g) =>
      g.series.forEach((s) => s.children && open.add(s.name)),
    );
    return open;
  });

  const toggle = (
    set: Set<string>,
    update: (s: Set<string>) => void,
    key: string,
  ) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };

  const periodStart = Math.max(0, selected - TABLE_PERIODS + 1);
  const periods = dates.slice(periodStart, selected + 1);
  const cols = 4 + periods.length;
  const latestLabel = freq === "A" ? "YoY chg" : "YTD chg";

  const renderRows = (nodes: SeriesNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const s = series[node.name];
      const hasKids = !!node.children?.length;
      const open = openRows.has(node.name);
      const kids =
        hasKids && open ? renderRows(node.children!, depth + 1) : null;
      if (!s) return <Fragment key={node.name}>{kids}</Fragment>;

      let li = Math.min(hi, s.last);
      while (li >= 0 && s.lvl[li] === null) li--;
      const latestChg = li >= 0 ? latestChange(s, li, freq) : null;
      const isPrimary = node.name === primary;
      const isCompare = node.name === compare;

      return (
        <Fragment key={node.name}>
          <tr
            onClick={() => onSelect(node.name)}
            aria-selected={isPrimary}
            className={cn(
              "group cursor-pointer border-b border-neutral-200 transition-colors",
              isPrimary
                ? "bg-(--portal-primary)/[0.07]"
                : "hover:bg-neutral-50",
            )}
          >
            <td
              className={cn(
                "border-l-[3px] py-2 pr-3",
                isPrimary
                  ? "border-l-(--portal-primary)"
                  : isCompare
                    ? "border-l-(--portal-accent)"
                    : "border-l-transparent",
              )}
              style={{ paddingLeft: 8 + depth * 18 }}
            >
              <div className="flex items-start gap-1">
                {hasKids ? (
                  <button
                    type="button"
                    aria-label={open ? "Collapse" : "Expand"}
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(openRows, setOpenRows, node.name);
                    }}
                    className="text-muted-foreground hover:text-foreground mt-px -ml-1 p-0.5"
                  >
                    {open ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                ) : (
                  depth > 0 && <span className="w-[18px] shrink-0" />
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-[13px] leading-snug",
                      isPrimary
                        ? "font-semibold text-(--portal-primary)"
                        : "text-foreground",
                      depth === 0 && hasKids && "font-semibold",
                    )}
                  >
                    {node.label}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    {unitsText(s)}
                  </div>
                </div>
              </div>
            </td>
            <td className="py-1 pr-3">
              <Sparkline values={s.lvl.slice(lo, hi + 1)} />
            </td>
            <td
              className="py-2 pr-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                aria-label={`Compare ${node.label}`}
                checked={isCompare}
                disabled={isPrimary}
                onCheckedChange={(v) => onCompare(v ? node.name : null)}
                className="rounded-none data-[state=checked]:border-(--portal-accent) data-[state=checked]:bg-(--portal-accent)"
              />
            </td>
            <td className="border-r border-neutral-200 py-2 pr-3 text-right tabular-nums">
              {li >= 0 && (
                <>
                  <div className="text-foreground text-[13px] font-medium">
                    {formatLevel(s, s.lvl[li])}
                  </div>
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">
                      {dates[li].tableDate}
                    </span>{" "}
                    <span style={{ color: changeColor(latestChg) }}>
                      {formatChange(latestChg, s.percent)}
                    </span>
                  </div>
                </>
              )}
            </td>
            {periods.map((d, k) => {
              const i = periodStart + k;
              return (
                <td
                  key={d.date}
                  className="py-2 pr-3 pl-2 text-right tabular-nums"
                >
                  <div className="text-foreground text-[13px]">
                    {formatLevel(s, s.lvl[i])}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: changeColor(s.pc1[i]) }}
                  >
                    {formatChange(s.pc1[i], s.percent)}
                  </div>
                </td>
              );
            })}
          </tr>
          {kids}
        </Fragment>
      );
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="text-muted-foreground border-y-2 border-neutral-800 text-[10px] tracking-wider uppercase">
            <th className="py-2 pr-3 pl-2 font-semibold">Indicator</th>
            <th className="w-[124px] py-2 pr-3 font-semibold">
              Trend
              <span className="block font-normal tracking-normal normal-case">
                {dates[lo]?.tableDate}–{dates[hi]?.tableDate}
              </span>
            </th>
            <th className="w-16 py-2 pr-3 text-center font-semibold">
              Compare
            </th>
            <th className="w-28 border-r border-neutral-200 py-2 pr-3 text-right font-semibold">
              Latest
              <span className="block font-normal tracking-normal normal-case">
                {latestLabel}
              </span>
            </th>
            {periods.map((d) => (
              <th
                key={d.date}
                className="w-24 py-2 pr-3 pl-2 text-right font-semibold"
              >
                {d.tableDate}
                <span className="block font-normal tracking-normal normal-case">
                  YoY chg
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {category.groups.map((g) => {
            const closed = closedGroups.has(g.title);
            return (
              <Fragment key={g.title}>
                <tr className="border-b border-neutral-300">
                  <td colSpan={cols} className="pt-4 pb-1.5">
                    <button
                      type="button"
                      aria-expanded={!closed}
                      onClick={() =>
                        toggle(closedGroups, setClosedGroups, g.title)
                      }
                      className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-(--portal-primary) uppercase hover:underline"
                    >
                      {closed ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                      {g.title}
                    </button>
                  </td>
                </tr>
                {!closed && renderRows(g.series, 0)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[11px]">
        <span
          aria-hidden
          className="inline-block h-3 w-[3px]"
          style={{ background: ACCENT }}
        />
        Click a row to chart it; tick Compare to add a second series on the left
        axis.
      </p>
    </div>
  );
}
