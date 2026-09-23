"use client";

import { useMemo, useState } from "react";
import type {
  CellValue,
  QueryResult,
} from "@catalog/collections/hhdb-query-builder-collection";
import type { OutputColumn } from "@catalog/utils/hhdb-query-builder/compile";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Code2,
  Copy,
  Download,
} from "lucide-react";

import { HhdbPagination } from "@/components/hhdb/hhdb-pagination";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RawTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Row = Record<string, CellValue>;

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dollarsCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatCell(v: CellValue, col: OutputColumn): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (col.format === "dollar")
      return Number.isInteger(v) ? dollars.format(v) : dollarsCents.format(v);
    if (col.format === "year") return String(v);
    if (col.format === "number") return plain.format(v);
    return Number.isInteger(v) ? String(v) : plain.format(v);
  }
  return v;
}

function csvField(v: CellValue): string {
  if (v === null) return "";
  const s = typeof v === "string" ? v : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(result: QueryResult): string {
  const header = result.columns
    .map((c) => csvField(c.key.replace("__", ".")))
    .join(",");
  const lines = result.rows.map((r) =>
    result.columns.map((c) => csvField(r[c.key])).join(","),
  );
  return [header, ...lines].join("\r\n");
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface ResultsTableProps {
  result: QueryResult;
  loading?: boolean;
}

export function ResultsTable({ result, loading }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const columns = useMemo<ColumnDef<Row, CellValue>[]>(
    () =>
      result.columns.map((col): ColumnDef<Row, CellValue> => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: () => (
          <div className="flex flex-col leading-tight">
            <span>{col.label}</span>
            {col.tableTitle && (
              <span className="text-muted-foreground text-[10px] font-normal">
                {col.tableTitle}
              </span>
            )}
          </div>
        ),
        cell: (ctx) => {
          const v = ctx.getValue();
          return (
            <span
              className={cn(
                col.kind === "number" && "tabular-nums",
                v === null && "text-muted-foreground",
              )}
            >
              {v === null ? "—" : formatCell(v, col)}
            </span>
          );
        },
        sortingFn: "basic",
        sortUndefined: "last",
      })),
    [result.columns],
  );

  const numeric = useMemo(
    () =>
      new Set(
        result.columns.filter((c) => c.kind === "number").map((c) => c.key),
      ),
    [result.columns],
  );

  const table = useReactTable({
    data: result.rows,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const copySql = async () => {
    await navigator.clipboard.writeText(result.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("space-y-3", loading && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span>
          <span className="font-medium">
            {result.rows.length.toLocaleString()}
          </span>{" "}
          {result.rows.length === 1 ? "row" : "rows"}
          <span className="text-muted-foreground">
            {" "}
            · {result.durationMs.toLocaleString()} ms
          </span>
        </span>
        {result.truncated && (
          <span className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-400">
            Row limit reached; more rows may exist. Raise the limit or narrow
            the filters.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSqlOpen((o) => !o)}
          >
            <Code2 className="size-4" />
            SQL
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={result.rows.length === 0}
            onClick={() =>
              download(
                `hhdb-query-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(result),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      <Collapsible open={sqlOpen} onOpenChange={setSqlOpen}>
        <CollapsibleTrigger className="sr-only">Toggle SQL</CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-muted/50 relative rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1.5 right-1.5 h-7"
              onClick={copySql}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <pre className="overflow-x-auto p-3 pr-24 font-mono text-xs whitespace-pre-wrap">
              {result.sql}
            </pre>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            This is the exact statement that ran. Paste it into R, DBeaver or
            the mysql CLI to go further than the builder allows.
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div className="max-h-[70vh] w-full overflow-auto rounded-md border">
        <RawTable className="w-auto min-w-0">
          <TableHeader className="bg-background sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const align = numeric.has(header.column.id)
                    ? "right"
                    : "left";
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "cursor-pointer text-left whitespace-nowrap select-none",
                        align === "right" && "text-right",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          align === "right" && "justify-end",
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="text-muted-foreground size-3" />
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="odd:bg-muted/50">
                  {row.getVisibleCells().map((cell) => {
                    const align = numeric.has(cell.column.id)
                      ? "right"
                      : "left";
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "max-w-md truncate text-left whitespace-nowrap",
                          align === "right" && "text-right",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No rows matched.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </RawTable>
      </div>

      {result.rows.length > pageSize && (
        <HhdbPagination
          page={pageIndex + 1}
          limit={pageSize}
          total={result.rows.length}
          onPageChange={(p) => setPageIndex(p - 1)}
          onLimitChange={(l) => {
            setPageSize(l);
            setPageIndex(0);
          }}
        />
      )}
    </div>
  );
}
