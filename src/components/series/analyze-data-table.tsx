"use client";

import { useCallback, useMemo, useState } from "react";
import { formatLevel } from "@catalog/utils/format";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  SERIES_COLORS,
  TRANSFORMATION_LABELS,
  type ChartRow,
  type Overlay,
  type Transformation,
} from "./analyze-chart";

/** Column labels for overlay data keys */
const OVERLAY_COLUMN_LABELS: Partial<
  Record<Overlay, { key: keyof ChartRow; label: string }>
> = {
  rollingMean: { key: "rollingMean", label: "Rolling x̄" },
  linearTrend: { key: "linearTrend", label: "Linear" },
  logLinearTrend: { key: "logLinearTrend", label: "Log-Lin" },
  hpTrend: { key: "hpTrend", label: "HP Trend" },
  rollingStdDev: { key: "rollingStdUpper", label: "±σ Upper" },
};

/** For rolling std dev we show two columns */
const OVERLAY_EXTRA_COLUMNS: Partial<
  Record<Overlay, { key: keyof ChartRow; label: string }>
> = {
  rollingStdDev: { key: "rollingStdLower", label: "±σ Lower" },
};

interface AnalyzeDataTableProps {
  /** Pre-built rows with overlay/transform fields already computed */
  rows: ChartRow[];
  decimals: number;
  unitShortLabel?: string | null;
  activeOverlays?: Overlay[];
  activeTransformation?: Transformation | null;
  secondAxis?: boolean;
  secondAxisTransformation?: Transformation | null;
  /** Multi-series compare mode: series names corresponding to series_0, series_1, ... */
  seriesNames?: string[];
}

const changeColor = (n: number) => {
  if (n === 0) return "text-slate-700";
  if (n > 0) return "text-green-800";
  return "text-red-800";
};

export function AnalyzeDataTable({
  rows,
  decimals,
  unitShortLabel,
  activeOverlays = [],
  activeTransformation = null,
  secondAxis = false,
  secondAxisTransformation = null,
  seriesNames,
}: AnalyzeDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [copied, setCopied] = useState(false);

  const fmtLevel = (n: number) => formatLevel(n, decimals, unitShortLabel);

  const FormattedCell = ({
    n,
    unit,
    isLevel,
    colored,
  }: {
    n: number | null | undefined;
    unit?: string;
    isLevel?: boolean;
    colored?: boolean;
  }) => {
    if (n == null || isNaN(n))
      return <span className="text-muted-foreground">-</span>;
    const value = isLevel
      ? fmtLevel(n)
      : unit === "perc"
        ? `${n.toFixed(decimals)}%`
        : n.toFixed(decimals);
    return (
      <span className={cn("text-end text-xs", colored && changeColor(n))}>
        {value}
      </span>
    );
  };

  const isCompareMode = seriesNames && seriesNames.length >= 2;

  const columns = useMemo(() => {
    const cols: ColumnDef<ChartRow>[] = [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => row.getValue<string>("date"),
      },
    ];

    // ── Compare mode: one column per series ──────────────────────────
    if (isCompareMode) {
      for (let i = 0; i < seriesNames.length; i++) {
        const key = `series_${i}`;
        const name = seriesNames[i];
        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        cols.push({
          id: key,
          accessorFn: (row) =>
            (row as unknown as Record<string, unknown>)[key] as
              | number
              | null
              | undefined,
          header: () => (
            <span className="text-end text-xs font-medium" style={{ color }}>
              {name}
            </span>
          ),
          cell: ({ cell }) => (
            <FormattedCell n={cell.getValue<number | null>()} isLevel />
          ),
        });
      }

      // Add transform columns for each series
      if (activeTransformation) {
        const transformLabel = TRANSFORMATION_LABELS[activeTransformation];
        for (let i = 0; i < seriesNames.length; i++) {
          const tKey = `transformed_${i}`;
          const name = seriesNames[i];
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          cols.push({
            id: tKey,
            accessorFn: (row) =>
              (row as unknown as Record<string, unknown>)[tKey] as
                | number
                | null
                | undefined,
            header: () => (
              <span className="text-end text-xs font-medium" style={{ color }}>
                {transformLabel} ({name})
              </span>
            ),
            cell: ({ cell }) => {
              const v = cell.getValue<number | null>();
              if (v == null || isNaN(v))
                return <span className="text-muted-foreground">-</span>;
              return <span className="text-end text-xs">{v.toFixed(2)}</span>;
            },
          });
        }
      }

      return cols;
    }

    // ── Standard columns ─────────────────────────────────────────────
    cols.push(
      {
        accessorKey: "level",
        header: () => <span className="text-end">Level</span>,
        cell: ({ cell }) => (
          <FormattedCell n={cell.getValue<number | null>()} isLevel />
        ),
      },
      {
        accessorKey: "levelChange",
        header: () => <span className="text-end">LVL Chg</span>,
        cell: ({ cell }) => (
          <FormattedCell n={cell.getValue<number | null>()} colored />
        ),
      },
      {
        accessorKey: "yoy",
        header: () => <span className="text-end">YOY %</span>,
        cell: ({ cell }) => (
          <FormattedCell
            n={cell.getValue<number | null>()}
            unit="perc"
            colored
          />
        ),
      },
      {
        accessorKey: "ytd",
        header: () => <span className="text-end">YTD %</span>,
        cell: ({ cell }) => (
          <FormattedCell
            n={cell.getValue<number | null>()}
            unit="perc"
            colored
          />
        ),
      },
    );

    // Add overlay columns
    for (const overlay of activeOverlays) {
      const info = OVERLAY_COLUMN_LABELS[overlay];
      if (info) {
        cols.push({
          accessorKey: info.key,
          header: () => (
            <span className="text-end text-blue-600">{info.label}</span>
          ),
          cell: ({ cell }) => (
            <FormattedCell n={cell.getValue<number | null>()} isLevel />
          ),
        });
      }
      const extra = OVERLAY_EXTRA_COLUMNS[overlay];
      if (extra) {
        cols.push({
          accessorKey: extra.key,
          header: () => (
            <span className="text-end text-blue-600">{extra.label}</span>
          ),
          cell: ({ cell }) => (
            <FormattedCell n={cell.getValue<number | null>()} isLevel />
          ),
        });
      }
    }

    // Main transformation column (stored in mainTransformed, level stays original)
    if (activeTransformation) {
      cols.push({
        accessorKey: "mainTransformed",
        header: () => (
          <span className="text-end text-violet-600">
            {TRANSFORMATION_LABELS[activeTransformation]}
          </span>
        ),
        cell: ({ cell }) => {
          const v = cell.getValue<number | null>();
          if (v == null || isNaN(v))
            return <span className="text-muted-foreground">-</span>;
          return <span className="text-end text-xs">{v.toFixed(2)}</span>;
        },
      });
    }

    // Second axis transformation column
    if (secondAxis && secondAxisTransformation) {
      cols.push({
        accessorKey: "transformedLevel",
        header: () => (
          <span className="text-end text-rose-600">
            {TRANSFORMATION_LABELS[secondAxisTransformation]}
          </span>
        ),
        cell: ({ cell }) => {
          const v = cell.getValue<number | null>();
          if (v == null || isNaN(v))
            return <span className="text-muted-foreground">-</span>;
          return <span className="text-end text-xs">{v.toFixed(2)}</span>;
        },
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCompareMode,
    seriesNames,
    activeOverlays,
    activeTransformation,
    secondAxis,
    secondAxisTransformation,
    decimals,
    unitShortLabel,
  ]);

  const copyAsCsv = useCallback(() => {
    const headers = columns.map((c) => {
      const key =
        (c as { accessorKey?: string }).accessorKey ??
        (c as { id?: string }).id ??
        "";
      return key;
    });
    const csvHeader = headers.join(",");
    const raw = (v: unknown) =>
      v != null && typeof v === "number" && !isNaN(v) ? String(v) : "";
    const csvRows = rows.map((r) =>
      headers
        .map((h) => raw((r as unknown as Record<string, unknown>)[h]))
        .join(",")
    );
    navigator.clipboard.writeText([csvHeader, ...csvRows].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rows, columns]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="w-fit">
      <div className="flex items-center justify-end pb-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={copyAsCsv}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy to Clipboard
            </>
          )}
        </Button>
      </div>
      <Table className="w-auto font-mono text-gray-800">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-end"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                className={cn(i % 2 === 0 ? "bg-muted/50" : "bg-white")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-end">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
