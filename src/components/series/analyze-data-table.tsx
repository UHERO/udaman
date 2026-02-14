"use client";

import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
}: AnalyzeDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const rows = useMemo(() => {
    const map = new Map<string, AnalyzeRow>();
    for (const [date, value] of data) {
      map.set(date, { date, level: value, levelChange: null, yoy: null, ytd: null });
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

  const FormattedCell = ({ n, unit }: { n: number | null; unit?: string }) => {
    if (n == null || isNaN(n)) return <span className="text-muted-foreground">-</span>;
    let value = n.toFixed(decimals);
    if (unit === "perc") value += "%";
    return (
      <span className={cn("text-end text-xs", dpColor(n))}>
        {value}
      </span>
    );
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
      cell: ({ row }) => {
        const d = new Date(row.getValue<string>("date") + "T00:00:00");
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: undefined,
        });
      },
    },
    {
      accessorKey: "level",
      header: () => <span className="text-end">Level</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} />,
    },
    {
      accessorKey: "levelChange",
      header: () => <span className="text-end">LVL Chg</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} />,
    },
    {
      accessorKey: "yoy",
      header: () => <span className="text-end">YOY %</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} unit="perc" />,
    },
    {
      accessorKey: "ytd",
      header: () => <span className="text-end">YTD %</span>,
      cell: ({ cell }) => <FormattedCell n={cell.getValue<number | null>()} unit="perc" />,
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
      <Table className="font-mono text-gray-800">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-end">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
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
