"use client";

import { useCallback, useContext, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { getSearchFields } from "@catalog/types/hhdb-search";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { HhdbColumnToggle } from "./hhdb-column-toggle";
import { HhdbTableLoadingContext } from "./hhdb-loading-context";
import { HhdbPagination } from "./hhdb-pagination";
import { HhdbSearch } from "./hhdb-search";
import { HhdbSearchFields } from "./hhdb-search-fields";

/** "permit_number" and "permitNumber" name the same column. */
const columnKey = (name: string) => name.replaceAll("_", "").toLowerCase();

/** "tract_geoid" -> "Tract Geoid", for a field with no table column to name it. */
const humanize = (field: string) =>
  field.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface HhdbDataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
  defaultHiddenColumns?: string[];
  searchPlaceholder?: string;
  disableSearch?: boolean;
}

export function HhdbDataTable<T>({
  columns,
  data,
  total,
  page,
  limit,
  search,
  sort,
  order,
  defaultHiddenColumns = [],
  searchPlaceholder,
  disableSearch = false,
}: HhdbDataTableProps<T>) {
  const loading = useContext(HhdbTableLoadingContext);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = searchParams.toString();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(segments);
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === "") {
          sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, segments],
  );

  const sorting: SortingState = sort
    ? [{ id: sort, desc: order === "desc" }]
    : [];

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => Object.fromEntries(defaultHiddenColumns.map((col) => [col, false])),
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) {
        updateParams({ sort: undefined, order: undefined, page: "1" });
      } else {
        updateParams({
          sort: next[0].id,
          order: next[0].desc ? "desc" : "asc",
          page: "1",
        });
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const { table: slug } = useParams<{ table?: string }>();
  const fields = slug ? getSearchFields(slug) : null;
  const headers = new Map(
    table
      .getAllColumns()
      .filter((col) => typeof col.columnDef.header === "string")
      .map((col) => [columnKey(col.id), col.columnDef.header as string]),
  );
  const fieldOptions = (fields ?? []).map((key) => ({
    key,
    label: headers.get(columnKey(key)) ?? humanize(key),
  }));
  const pickedParam = searchParams.get("searchFields")?.split(",") ?? [];
  const picked = fieldOptions.filter((o) => pickedParam.includes(o.key));
  const narrowed = picked.length > 0 && picked.length < fieldOptions.length;
  const placeholder = !narrowed
    ? searchPlaceholder
    : picked.length === 1
      ? `Search ${picked[0].label}...`
      : `Search ${picked.length} fields...`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!disableSearch && (
          <div className="flex w-full max-w-lg items-center gap-2">
            <HhdbSearch
              value={search}
              onChange={(v) =>
                updateParams({ search: v || undefined, page: "1" })
              }
              placeholder={placeholder}
            />
            {fieldOptions.length > 0 && (
              <HhdbSearchFields
                options={fieldOptions}
                value={picked.map((o) => o.key)}
                onChange={(next) =>
                  updateParams({
                    searchFields: next.join(",") || undefined,
                    // Only a live search changes the result set.
                    ...(search ? { page: "1" } : {}),
                  })
                }
              />
            )}
          </div>
        )}
        <HhdbColumnToggle table={table} />
      </div>

      <div className="bg-background relative overflow-hidden rounded-md border">
        {loading && (
          <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none" : ""}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                          ))}
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <HhdbPagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={(p) => updateParams({ page: String(p) })}
        onLimitChange={(l) => updateParams({ limit: String(l), page: "1" })}
      />
    </div>
  );
}
