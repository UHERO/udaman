"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Eraser, Loader2, RefreshCw, RotateCcw } from "lucide-react";

import {
  clearPendingRecords,
  getQpubDashboardStats,
  resetFailedRecords,
  type PipelineStatusCounts,
  type QpubDashboardStats,
  type FailedRecord,
} from "@/actions/crawlers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Pipeline status row ────────────────────────────────────────────

function PipelineRow({
  label,
  counts,
}: {
  label: string;
  counts: PipelineStatusCounts;
}) {
  const total = counts.pending + counts.success + counts.failed;
  const pct = total > 0 ? Math.round((counts.success / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-14 font-medium">{label}</span>
      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-2 text-xs">
        <span className="text-yellow-700">
          {fmt(counts.pending)} {label === "Scrape" ? "in progress" : "pending"}
        </span>
        <span className="text-green-700">{fmt(counts.success)} ok</span>
        <span className="text-red-700">{fmt(counts.failed)} fail</span>
      </div>
    </div>
  );
}

// ─── Stat display ───────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// ─── Failed records table ───────────────────────────────────────────

function FailedRecordsTable({ records }: { records: FailedRecord[] }) {
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No failed records.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Recent Failures ({records.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TMK</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Retries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.tmk}>
                <TableCell className="font-mono text-xs">{r.tmk}</TableCell>
                <TableCell>
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.stage === "scrape"
                        ? "bg-blue-100 text-blue-800"
                        : r.stage === "parse"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.stage}
                  </span>
                </TableCell>
                <TableCell className="max-w-60 truncate text-xs">
                  {r.error || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDate(r.updatedAt)}
                </TableCell>
                <TableCell className="text-right">{r.retryCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export default function QpubScraperPanel({
  initialStats,
}: {
  initialStats: QpubDashboardStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [isClearing, startClearTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getQpubDashboardStats();
      setStats(result);
      setLastUpdated(new Date());
    });
  }, []);

  // Poll every 10s
  useEffect(() => {
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  function handleResetFailed() {
    if (
      !confirm(
        "This will reset all failed scrape/parse/load records so they can be retried. Continue?",
      )
    ) {
      return;
    }
    setActionMessage(null);
    startResetTransition(async () => {
      const count = await resetFailedRecords();
      setActionMessage(`Reset ${count} failed records`);
      refresh();
    });
  }

  function handleClearPending() {
    if (
      !confirm(
        "This will reset all pending scrape records back to success. Use this to clear orphaned records from crashed scrapers. Continue?",
      )
    ) {
      return;
    }
    setActionMessage(null);
    startClearTransition(async () => {
      const count = await clearPendingRecords();
      setActionMessage(`Cleared ${count} pending records`);
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-xs">
          Updated {formatTime(lastUpdated)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isPending}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetFailed}
          disabled={isResetting}
        >
          {isResetting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Reset Failed
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearPending}
          disabled={isClearing || stats.scrape.pending === 0}
        >
          {isClearing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
          )}
          Clear Pending ({fmt(stats.scrape.pending)})
        </Button>
      </div>

      {/* Action status message */}
      {actionMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {actionMessage}
        </div>
      )}

      {/* Top row: Scrape Progress + Last Batch */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Scrape Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scrape Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold">{stats.scrapePercent}%</span>
              <span className="text-muted-foreground pb-1 text-sm">
                {fmt(stats.freshScrapes)} / {fmt(stats.totalRecords)} current
              </span>
            </div>
            <div className="bg-muted h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${stats.scrapePercent}%` }}
              />
            </div>
            <div className="flex gap-4">
              <Stat label="Today" value={fmt(stats.scrapedToday)} />
              <Stat label="This Month" value={fmt(stats.scrapedThisMonth)} />
            </div>
          </CardContent>
        </Card>

        {/* Last Batch */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Last Batch (24h)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Parsed" value={fmt(stats.parsedLastBatch)} />
              <Stat label="Loaded" value={fmt(stats.loadedLastBatch)} />
              <Stat
                label="Scrape → Load"
                value={`${stats.scrapeToLoadPercent}%`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <PipelineRow label="Scrape" counts={stats.scrape} />
          <PipelineRow label="Parse" counts={stats.parse} />
          <PipelineRow label="Load" counts={stats.load} />
        </CardContent>
      </Card>

      {/* Failed Records */}
      <FailedRecordsTable records={stats.recentFailures} />
    </div>
  );
}
