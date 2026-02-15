"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLevel } from "@catalog/utils/format";
import { cn } from "@/lib/utils";

interface AnalyzeRow {
  date: string;
  level: number | null;
  levelChange: number | null;
  yoy: number | null;
  ytd: number | null;
}

interface AnalyzeDataTableProps {
  data: [string, number][];
  yoy: [string, number][];
  levelChange: [string, number][];
  ytd: [string, number][];
  decimals: number;
  unitShortLabel?: string | null;
}

const dpColor = (n: number) => {
  if (n === 0) return "text-slate-700";
  if (n > 0) return "text-green-800";
  return "text-red-800";
};

export function AnalyzeDataTable({
  data,
  yoy,
  levelChange,
  ytd,
  decimals,
  unitShortLabel,
}: AnalyzeDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string, AnalyzeRow>();
    for (const [date, value] of data) {
      map.set(date, {
        date,
        level: value,
        levelChange: null,
        yoy: null,
        ytd: null,
      });
    }
    for (const [date, value] of levelChange) {
      const row = map.get(date);
      if (row) row.levelChange = value;
    }
    for (const [date, value] of yoy) {
      const row = map.get(date);
      if (row) row.yoy = value;
    }
    for (const [date, value] of ytd) {
      const row = map.get(date);
      if (row) row.ytd = value;
    }
    return [...map.values()];
  }, [data, yoy, levelChange, ytd]);

  const copyAsCsv = useCallback(() => {
    const header = "Date,Level,LVL Chg,YOY %,YTD %";
    const raw = (v: number | null) => (v != null ? String(v) : "");
    const csvRows = rows.map((r) =>
      `${r.date},${raw(r.level)},${raw(r.levelChange)},${raw(r.yoy)},${raw(r.ytd)}`,
    );
    navigator.clipboard.writeText([header, ...csvRows].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rows]);

  const fmtLevel = (n: number) => formatLevel(n, decimals, unitShortLabel);

  const FormattedCell = ({ n, unit, isLevel }: { n: number | null; unit?: string; isLevel?: boolean }) => {
    if (n == null || isNaN(n))
      return <span className="text-muted-foreground">-</span>;
    const value = isLevel ? fmtLevel(n) : unit === "perc" ? `${n.toFixed(decimals)}%` : n.toFixed(decimals);
    return <span className={cn("text-end text-xs", dpColor(n))}>{value}</span>;
  };

  const columns: ColumnDef<AnalyzeRow>[] = [
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
    {
      accessorKey: "level",
      header: () => <span className="text-end">Level</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} isLevel />,
    },
    {
      accessorKey: "levelChange",
      header: () => <span className="text-end">LVL Chg</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} isLevel />,
    },
    {
      accessorKey: "yoy",
      header: () => <span className="text-end">YOY %</span>,
      cell: ({ cell }) => (
        <FormattedCell n={cell.getValue<number | null>()} unit="perc" />
      ),
    },
    {
      accessorKey: "ytd",
      header: () => <span className="text-end">YTD %</span>,
      cell: ({ cell }) => (
        <FormattedCell n={cell.getValue<number | null>()} unit="perc" />
      ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-end px-4 pt-3">
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
              Copy
            </>
          )}
        </Button>
      </div>
      <Table className="font-mono text-gray-800">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-end">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
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
