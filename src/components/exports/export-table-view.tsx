"use client";

import Link from "next/link";

import type { ExportTableRow } from "@catalog/controllers/exports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkline } from "@/components/data-list/sparkline";

function fmt(value: number | null, decimals: number): string {
  if (value == null) return "";
  return value.toFixed(decimals);
}

function fmtPct(value: number | null): string {
  if (value == null) return "";
  return value.toFixed(1) + "%";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

interface Props {
  data: ExportTableRow[];
  universe: string;
}

export function ExportTableView({ data, universe }: Props) {
  if (data.length === 0) {
    return <p className="text-muted-foreground">No series in this export.</p>;
  }

  // Collect all unique dates across last-three arrays to build column headers
  const dateColumns: string[] = [];
  for (const row of data) {
    for (const pt of row.lastThree) {
      if (!dateColumns.includes(pt.date)) dateColumns.push(pt.date);
    }
  }
  dateColumns.sort();
  // Take the last 3 unique dates
  const displayDates = dateColumns.slice(-3);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Name</TableHead>
            {displayDates.map((date) => (
              <TableHead key={date} className="text-right">
                <div>{formatDate(date)}</div>
                <div className="text-muted-foreground text-xs font-normal">
                  Val / Chg / YOY%
                </div>
              </TableHead>
            ))}
            <TableHead className="text-right">YTD%</TableHead>
            <TableHead>Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const ptMap = new Map(row.lastThree.map((pt) => [pt.date, pt]));

            return (
              <TableRow key={row.seriesId}>
                <TableCell>
                  <Link
                    href={`/udaman/${universe}/series/${row.seriesId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                {displayDates.map((date) => {
                  const pt = ptMap.get(date);
                  return (
                    <TableCell key={date} className="text-right tabular-nums">
                      {pt ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{fmt(pt.value, row.decimals)}</span>
                          <span className="text-muted-foreground text-xs">
                            {fmt(pt.lvlChange, row.decimals)} /{" "}
                            {fmtPct(pt.yoyPct)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right tabular-nums">
                  {fmtPct(row.ytdPct)}
                </TableCell>
                <TableCell>
                  <Sparkline data={row.sparkData} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
