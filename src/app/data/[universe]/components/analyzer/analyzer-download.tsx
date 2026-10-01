"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getChartPalette } from "../../lib/config";
import { downloadCsv, toCsv } from "../../lib/csv";
import { formatNum } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import { specStroke } from "./analyzer-chart";
import { analyzerChartRows, axisTitle, specKey } from "./analyzer-model";
import type { AnalyzerSeriesSpec } from "./analyzer-model";
import { exportChartImage, exportTablePdf } from "./chart-export";
import type { ImageFormat } from "./chart-export";

/**
 * Analyzer Download menu (header, beside Share): chart image/PDF exports
 * when the Compare chart is showing (`chartRef` mounted), plus CSV and a
 * PDF table of the compared series' visible range in either view.
 */
export function AnalyzerDownload({
  specs,
  baseDate,
  startDate,
  endDate,
  chartRef,
  chartShown,
  className,
}: {
  specs: AnalyzerSeriesSpec[];
  baseDate: string | null;
  startDate: string;
  endDate: string;
  chartRef: React.RefObject<HTMLDivElement | null>;
  /** Compare view is active (image exports need the rendered chart). */
  chartShown: boolean;
  className?: string;
}) {
  const { config } = usePortalConfig();
  const palette = getChartPalette(config);
  const visible = specs.filter((s) => s.visible);
  const title = `${config.shortTitle} Analyzer`;
  const subtitle = `${startDate} – ${endDate}`;
  const exportSource = [
    config.exportLabels.portal,
    config.exportLabels.portalLink,
  ];

  const exportImage = (format: ImageFormat) => {
    if (!chartRef.current) return;
    void exportChartImage(chartRef.current, format, "chart", {
      leftTitle: visible.some((s) => s.axis === "left")
        ? axisTitle(specs, "left")
        : undefined,
      rightTitle: visible.some((s) => s.axis === "right")
        ? axisTitle(specs, "right")
        : undefined,
      legend: visible.map((s) => ({
        color: specStroke(palette, s.slot).color,
        dashed: !!specStroke(palette, s.slot).dash,
        kind: s.type === "column" ? ("bar" as const) : ("line" as const),
        label: `${s.name} (${s.axis})`,
      })),
      credits: config.seriesChart.credits,
      title,
      subtitle,
      source: exportSource,
    });
  };
  const exportTable = () => {
    const { rows } = analyzerChartRows(specs, baseDate, startDate, endDate);
    void exportTablePdf({
      fileName: "chart",
      title,
      subtitle,
      head: ["Date", ...visible.map((s) => `${s.name} (${s.axis})`)],
      body: rows
        .slice()
        .reverse()
        .map((r) => [
          r.date,
          ...visible.map((s) => {
            const v = r[specKey(s.id)];
            return typeof v === "number"
              ? formatNum(v, s.decimals, config.universe)
              : "";
          }),
        ]),
      footer: exportSource,
      columnsPerBlock: 4,
      orientation: "landscape",
    });
  };
  const exportCsv = () => {
    const { rows } = analyzerChartRows(specs, baseDate, startDate, endDate);
    const body = [
      ["Date", ...visible.map((s) => `${s.name} (${s.axis})`)],
      ...rows.map((r) => [
        r.date,
        ...visible.map((s) => r[specKey(s.id)] ?? null),
      ]),
    ];
    const meta = [config.exportLabels.portal, config.exportLabels.portalLink]
      .filter(Boolean)
      .join("\n");
    downloadCsv("chart", `${meta}\n\n${toCsv(body)}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className ?? "h-8 rounded-none px-2.5 text-xs shadow-none"}
        >
          <Download className="size-3.5" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-none">
        {chartShown && (
          <>
            <DropdownMenuItem onSelect={() => exportImage("png")}>
              PNG image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportImage("jpeg")}>
              JPEG image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportImage("svg")}>
              SVG vector image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportImage("pdf")}>
              PDF (chart)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={exportCsv}>
          CSV (chart data)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportTable}>
          PDF (chart data table)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
