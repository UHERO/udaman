"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { SeriesAuditRow } from "@catalog/types/shared";
import { Loader2 } from "lucide-react";

import { getSeriesWithNullField } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PER_PAGE = 50;

type NullFieldKey = (typeof NULL_FIELD_OPTIONS)[number]["value"];

const NULL_FIELD_OPTIONS = [
  { value: "source_id", label: "Source" },
  { value: "unit_id", label: "Unit" },
  { value: "source_detail_id", label: "Source Detail" },
  { value: "geography_id", label: "Geography" },
  { value: "dataPortalName", label: "Data Portal Name" },
  { value: "description", label: "Description" },
  { value: "source_link", label: "Source Link" },
] as const;

export function NullFieldSeriesTable({ universe }: { universe: string }) {
  const [field, setField] = useState<NullFieldKey>("source_id");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SeriesAuditRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  const fetchData = useCallback(
    (f: NullFieldKey, p: number) => {
      startTransition(async () => {
        const result = await getSeriesWithNullField(universe, f, p, PER_PAGE);
        setRows(result.rows);
        setTotalCount(result.totalCount);
      });
    },
    [universe],
  );

  useEffect(() => {
    fetchData(field, page);
  }, [field, page, fetchData]);

  const handleFieldChange = (value: string) => {
    setField(value as NullFieldKey);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Select a field
          </label>
          <Select value={field} onValueChange={handleFieldChange}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NULL_FIELD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-muted-foreground pb-2 text-sm">
          {isPending ? (
            <Loader2 className="inline size-4 animate-spin" />
          ) : (
            <>
              {totalCount} series with no{" "}
              <span className="font-medium">
                {NULL_FIELD_OPTIONS.find((o) => o.value === field)?.label}
              </span>
            </>
          )}
        </p>
      </div>
      <p>
        {`Edit individual series on their page or in bulk through their `}
        <Link href="/udaman/uhero/catalog/measurements">Measurement.</Link>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-64">Name</TableHead>
            <TableHead className="w-64">Data Portal Name</TableHead>
            <TableHead>Loaders</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && !isPending ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground h-24 text-center"
              >
                No series found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="group cursor-pointer"
                onClick={() =>
                  (window.location.href = `/udaman/${universe}/series/${row.id}`)
                }
              >
                <TableCell className="text-muted-foreground w-8">
                  <span className="invisible group-hover:visible">&rarr;</span>
                </TableCell>
                <TableCell className="font-mono text-sm">{row.name}</TableCell>
                <TableCell className="text-sm">
                  {row.dataPortalName ?? "-"}
                </TableCell>
                <TableCell className="max-w-md text-xs">
                  {row.loaderEvals.length > 0 ? (
                    <div className="space-y-0.5">
                      {row.loaderEvals.map((e, i) => (
                        <div
                          key={i}
                          className="text-muted-foreground truncate font-mono"
                          title={e}
                        >
                          {e}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
