"use client";

import { DataPoint } from "@catalog/types/shared";
import { formatLevel } from "@catalog/utils/format";
import { dpAgeCode, uheroDate } from "@catalog/utils/time";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getColor } from "../helpers";
import { DataPointTooltip } from "./data-point-hover-card";
import { useSeriesHover } from "./series-data-section";

const isNumber = (val: unknown): val is number => {
  if (val === null || val === undefined) return false;
  if (typeof val !== "number") return false;
  if (isNaN(val)) return false;
  return true;
};

const dpColor = (n: number) => {
  if (n === 0) return "text-slate-700";
  if (n > 0) return "text-green-800";
  return "text-red-800";
};

export const SeriesDataTable = ({
  data,
  options,
}: {
  data: DataPoint[];
  options: {
    decimals: number;
    showLoaderCol: boolean;
    xseriesId: number;
    universe: string;
    seriesId: number;
    unitShortLabel?: string | null;
  };
}) => {
  const { setHoveredDate } = useSeriesHover();
  const { decimals } = options;

  const { unitShortLabel } = options;

  const FormattedCell = ({ n, unit, isLevel }: { n: number | null; unit?: string; isLevel?: boolean }) => {
    if (!isNumber(n)) return "-";
    const value = isLevel
      ? formatLevel(n, decimals, unitShortLabel)
      : unit === "perc"
        ? `${n.toFixed(decimals)}%`
        : n.toFixed(decimals);
    return (
      <span
        className={cn("w-full text-end text-xs text-slate-600", dpColor(n))}
      >
        {value}
      </span>
    );
  };

  const columns: ColumnDef<DataPoint>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => uheroDate(row.getValue("date")),
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ cell, row }) => {
        const val = cell.getValue() as number | null;
        const displayValue = isNumber(val) ? formatLevel(val, decimals, unitShortLabel) : "-";
        const rowDate = row.getValue("date") as Date;
        const dateStr = format(rowDate, "yyyy-MM-dd");
        return (
          <DataPointTooltip
            value={displayValue}
            xseriesId={options.xseriesId}
            date={dateStr}
            universe={options.universe}
            seriesId={options.seriesId}
            decimals={decimals}
          />
        );
      },
    },
    {
      accessorKey: "yoy",
      header: "YOY",
      meta: {
        className: "text-primary/60 w-full text-end text-xs",
      },
      cell: ({ cell }) => {
        const val = cell.getValue() as number | null;
        return <FormattedCell n={val} unit="perc" />;
      },
    },
    {
      accessorKey: "ytd",
      header: "YTD",
      cell: ({ cell }) => {
        const val = cell.getValue() as number | null;
        return <FormattedCell n={val} unit="perc" />;
      },
    },
    {
      accessorKey: "lvl_change",
      header: "LVL",
      cell: ({ cell }) => {
        const val = cell.getValue() as number | null;
        return <FormattedCell n={val} isLevel />;
      },
    },
    {
      accessorKey: "updated_at",
      header: "Age",
      cell: ({ row }) =>
        dpAgeCode(row.getValue("updated_at"), row.getValue("pseudo_history")),
    },
    {
      accessorKey: "loader_id",
      header: "Loader",
    },
    {
      accessorKey: "pseudo_history",
      header: "pseudo_history",
    },
    {
      accessorKey: "color",
      header: "color",
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: {
        pseudo_history: false,
        color: false,
        loader_id: options.showLoaderCol,
      },
    },
  });
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div>
        <Table className="border-separate border-spacing-1 font-mono text-gray-800">
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
                  data-state={row.getIsSelected() && "selected"}
                  className={cn("group", i % 2 === 0 ? "bg-muted" : "bg-none")}
                  onMouseEnter={() => setHoveredDate(row.getValue("date"))}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "group-hover:bg-muted cursor-default border-b bg-white text-end",
                        cell.column.id === "value" &&
                          getColor(cell.row.getValue("color")),
                      )}
                    >
                      {/* {cell.getValue() ?? "-"} */}
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-5 text-end">
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
        </Table>
      </div>
    </TooltipProvider>
  );
};
