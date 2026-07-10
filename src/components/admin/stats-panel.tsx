"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { getStats, type StatsData } from "@/actions/stats";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PERIODS = [7, 30, 90] as const;

export default function StatsPanel({
  initialData,
  initialDays,
}: {
  initialData: StatsData;
  initialDays: number;
}) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState(initialDays);
  const [isPending, startTransition] = useTransition();

  function changePeriod(d: number) {
    setDays(d);
    startTransition(async () => {
      const result = await getStats(d);
      setData(result);
    });
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p}
            variant={days === p ? "default" : "outline"}
            size="sm"
            onClick={() => changePeriod(p)}
            disabled={isPending}
          >
            {p}d
          </Button>
        ))}
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Top Pages</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-20 text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPages.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-muted-foreground text-sm"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topPages.map((row) => (
                    <TableRow key={row.path}>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {row.path}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.views.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Most Viewed Series */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Most Viewed Series</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
                  <TableHead className="w-20 text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topSeries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-muted-foreground text-sm"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topSeries.map((row) => (
                    <TableRow key={row.seriesId}>
                      <TableCell className="max-w-xs truncate text-sm">
                        <Link
                          href={`/udaman/UHERO/series/${row.seriesId}`}
                          className="text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.views.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Most Active Users */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Most Active Users</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="w-24 text-right">Page Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mostActiveUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-muted-foreground text-sm"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  data.mostActiveUsers.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="text-sm">{row.username}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.views.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Top Actions */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Top Actions</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-20 text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topActions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-muted-foreground text-sm"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topActions.map((row) => (
                    <TableRow key={row.action}>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {row.action}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {/* Daily Activity — full width */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Daily Activity</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="w-24 text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dailyActivity.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-muted-foreground text-sm"
                  >
                    No data
                  </TableCell>
                </TableRow>
              ) : (
                data.dailyActivity.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.views.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
