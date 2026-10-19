"use client";

import { useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3";

import { useElementWidth } from "@/app/data/[universe]/components/ui/use-element-width";
import { formatNum } from "@/app/data/[universe]/lib/format";

import type { SeriesNode } from "../lib/categories";
import type { DashboardSeries } from "../lib/data";
import { changeColor, formatChange, SECTOR_COLORS } from "../lib/theme";

interface TreeDatum {
  name: string;
  label: string;
  value?: number;
  children?: TreeDatum[];
}

/**
 * Labor Market slice panel (old treemap): the jobs hierarchy under a parent
 * at the selected date. Area = jobs in the most detailed available sector
 * (leaves are summed, so the aggregate series aren't needed); color = top
 * level sector. Hover shows the path, jobs, and YoY change.
 */
export function JobsTreemap({
  root,
  series,
  selected,
  dateLabel,
  height = 300,
}: {
  root: SeriesNode;
  series: Record<string, DashboardSeries | null>;
  selected: number;
  dateLabel: string;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);
  const [hover, setHover] = useState<{
    name: string;
    path: string[];
    x: number;
    y: number;
  } | null>(null);

  const layout = useMemo(() => {
    if (!width) return null;
    // A node with data children is split; otherwise it's a leaf valued at
    // its own level (children without data at this date are dropped).
    const toDatum = (n: SeriesNode): TreeDatum | null => {
      const kids = (n.children ?? [])
        .map(toDatum)
        .filter((d): d is TreeDatum => !!d);
      if (kids.length) return { name: n.name, label: n.label, children: kids };
      const v = series[n.name]?.lvl[selected];
      return v && v > 0 ? { name: n.name, label: n.label, value: v } : null;
    };
    const sectors = (root.children ?? [])
      .map(toDatum)
      .filter((d): d is TreeDatum => !!d);
    const h = hierarchy<TreeDatum>({
      name: root.name,
      label: root.label,
      children: sectors,
    })
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<TreeDatum>()
      .size([width, height])
      .tile(treemapSquarify.ratio(1.2))
      .paddingInner(1)
      .paddingOuter(0)
      .round(true)(h);
  }, [root, series, selected, width, height]);

  // Sector color by its position in the config (stable as the date moves).
  const sectorIndex = useMemo(
    () => Object.fromEntries((root.children ?? []).map((c, i) => [c.name, i])),
    [root],
  );

  const sectors = layout?.children ?? [];
  const leaves = layout?.leaves() ?? [];
  const hovered = hover ? series[hover.name] : null;

  return (
    <div className="w-full">
      <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px] tracking-wide">
        <span>Jobs by industry · {dateLabel}</span>
        <span>
          Total{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatNum(layout?.value, 1)}
          </span>{" "}
          {series[root.name]?.unitsShort}
        </span>
      </div>
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {layout && (
          <svg width={width} height={height} className="block">
            {leaves.map((leaf) => {
              const sector = leaf.ancestors().at(-2) ?? leaf;
              const color =
                SECTOR_COLORS[
                  (sectorIndex[sector.data.name] ?? 0) % SECTOR_COLORS.length
                ];
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              // Deeper tiles a touch lighter so sub-sectors read as parts.
              const opacity = leaf.depth > 1 ? 0.78 : 1;
              const dim = hover && hover.name !== leaf.data.name;
              return (
                <g
                  key={leaf.data.name}
                  transform={`translate(${leaf.x0},${leaf.y0})`}
                  onMouseMove={(e) => {
                    const box = wrapRef.current!.getBoundingClientRect();
                    setHover({
                      name: leaf.data.name,
                      path: leaf
                        .ancestors()
                        .slice(0, -1)
                        .map((a) => a.data.label),
                      x: e.clientX - box.left,
                      y: e.clientY - box.top,
                    });
                  }}
                >
                  <rect
                    width={w}
                    height={h}
                    fill={color}
                    fillOpacity={dim ? opacity * 0.55 : opacity}
                  />
                  {w > 64 && h > 30 && (
                    <text
                      x={5}
                      y={14}
                      fill="#fff"
                      fontSize={10.5}
                      className="pointer-events-none"
                    >
                      <tspan fontWeight={600}>{clip(leaf.data.label, w)}</tspan>
                      <tspan x={5} dy={13} fillOpacity={0.85}>
                        {formatNum(leaf.value, 1)}
                      </tspan>
                    </text>
                  )}
                </g>
              );
            })}
            {/* Sector outlines on top. */}
            {sectors.map((s) => (
              <rect
                key={s.data.name}
                x={s.x0}
                y={s.y0}
                width={s.x1 - s.x0}
                height={s.y1 - s.y0}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                className="pointer-events-none"
              />
            ))}
          </svg>
        )}
        {hover && hovered && (
          <div
            className="bg-card border-border pointer-events-none absolute z-10 min-w-48 border px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: Math.min(hover.x + 12, Math.max(0, width - 220)),
              top: Math.min(hover.y + 12, height - 70),
            }}
          >
            <div className="text-foreground font-medium">{hover.path[0]}</div>
            {hover.path.length > 1 && (
              <div className="text-muted-foreground mb-1 text-[10px]">
                {hover.path.slice(1).reverse().join(" › ")}
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Jobs ({hovered.unitsShort})
              </span>
              <span className="tabular-nums">
                {formatNum(hovered.lvl[selected], hovered.decimals)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">YoY</span>
              <span
                className="tabular-nums"
                style={{ color: changeColor(hovered.pc1[selected]) }}
              >
                {formatChange(hovered.pc1[selected], hovered.percent) || "–"}
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
        Box area is proportional to jobs; color marks the top-level sector.
      </p>
    </div>
  );
}

/** Truncate a label to roughly fit a tile `w` px wide at 10.5px. */
function clip(label: string, w: number) {
  const max = Math.floor((w - 10) / 5.6);
  return label.length > max
    ? `${label.slice(0, Math.max(1, max - 1))}…`
    : label;
}
