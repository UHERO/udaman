"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";

import {
  getQpubDbStats,
  resetFailedRecords,
  type PipelineStatusCounts,
  type QpubDbStats,
} from "@/actions/crawlers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ─── Helpers ────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
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
          {formatNumber(counts.pending)} pending
        </span>
        <span className="text-green-700">
          {formatNumber(counts.success)} ok
        </span>
        <span className="text-red-700">{formatNumber(counts.failed)} fail</span>
      </div>
    </div>
  );
}

// ─── DB Stats Card ──────────────────────────────────────────────────

function DbStatsCard({
  stats,
  lastUpdated,
}: {
  stats: QpubDbStats;
  lastUpdated: Date;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Pipeline Status</CardTitle>
            <CardDescription>
              From scrape_status table &middot; Updated{" "}
              {formatTime(lastUpdated)}
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatNumber(stats.scrapedToday)}
              </div>
              <div className="text-muted-foreground text-xs">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatNumber(stats.scrapedThisMonth)}
              </div>
              <div className="text-muted-foreground text-xs">This Month</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <PipelineRow label="Scrape" counts={stats.scrape} />
        <PipelineRow label="Parse" counts={stats.parse} />
        <PipelineRow label="Load" counts={stats.load} />
      </CardContent>
    </Card>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export default function QpubScraperPanel({
  initialDbStats,
}: {
  initialDbStats: QpubDbStats;
}) {
  const [dbStats, setDbStats] = useState(initialDbStats);
  const [lastDbUpdate, setLastDbUpdate] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const refreshDb = useCallback(() => {
    startTransition(async () => {
      const result = await getQpubDbStats();
      setDbStats(result);
      setLastDbUpdate(new Date());
    });
  }, []);

  // DB stats poll: every 60s
  useEffect(() => {
    const interval = setInterval(refreshDb, 60_000);
    return () => clearInterval(interval);
  }, [refreshDb]);

  function handleResetFailed() {
    if (
      !confirm(
        "This will reset all failed scrape/parse/load records so they can be retried. Continue?",
      )
    ) {
      return;
    }
    setResetMessage(null);
    startResetTransition(async () => {
      const count = await resetFailedRecords();
      setResetMessage(`Reset ${count} failed records`);
      refreshDb();
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-xs">
          Updated: {formatTime(lastDbUpdate)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshDb}
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
      </div>

      {/* Reset status message */}
      {resetMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {resetMessage}
        </div>
      )}

      {/* DB pipeline stats */}
      <DbStatsCard stats={dbStats} lastUpdated={lastDbUpdate} />
    </div>
  );
}
