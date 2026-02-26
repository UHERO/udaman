"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  drainScraperQueue,
  getQpubDbStats,
  getQpubScraperStatus,
  seedQpubScraper,
  type QpubDbStats,
  type QpubScraperStatus,
  type PipelineStatusCounts,
} from "@/actions/crawlers";
import { getJobLogs, type JobState, type SerializedJob } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const mon = SHORT_MONTHS[d.getMonth()];
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mon} ${day}, ${hh}:${mm}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start || !end) return "";
  const ms = end - start;
  if (ms < 0) return "";
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ─── Status badge ───────────────────────────────────────────────────

const STATE_STYLES: Record<JobState, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  waiting: "bg-yellow-100 text-yellow-800",
  delayed: "bg-orange-100 text-orange-800",
};

function StateBadge({ state }: { state: JobState }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}
    >
      {state === "active" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state}
    </span>
  );
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
        <span className="text-yellow-700">{formatNumber(counts.pending)} pending</span>
        <span className="text-green-700">{formatNumber(counts.success)} ok</span>
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
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Pipeline Status</CardTitle>
            <CardDescription>
              From scrape_status table &middot; Updated {formatTime(lastUpdated)}
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(stats.scrapedToday)}</div>
              <div className="text-muted-foreground text-xs">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatNumber(stats.scrapedThisMonth)}</div>
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

// ─── Expandable job row ─────────────────────────────────────────────

function JobRow({ job }: { job: SerializedJob }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const tmk = job.data.tmk ? String(job.data.tmk) : null;

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && logs === null) {
      setLoadingLogs(true);
      try {
        const result = await getJobLogs(job.queue, job.id);
        setLogs(result);
      } catch {
        setLogs(["Failed to load logs"]);
      } finally {
        setLoadingLogs(false);
      }
    }
  }

  return (
    <>
      <TableRow
        className="hover:bg-muted/50 cursor-pointer"
        onClick={handleExpand}
      >
        <TableCell className="w-6 px-2">
          {expanded ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {tmk ?? job.name}
        </TableCell>
        <TableCell className="text-xs">
          {formatDate(job.processedOn ?? job.timestamp)}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {job.state === "active"
            ? formatDuration(job.processedOn, Date.now())
            : formatDuration(job.processedOn, job.finishedOn)}
        </TableCell>
        <TableCell className="max-w-xs truncate text-xs">
          {job.failedReason ? (
            <span className="text-red-600">{job.failedReason}</span>
          ) : job.state === "completed" && job.returnvalue ? (
            <span className="text-muted-foreground">{String(job.returnvalue)}</span>
          ) : null}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Job Data
                </h4>
                <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Logs
                </h4>
                {loadingLogs ? (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading logs...
                  </div>
                ) : logs && logs.length > 0 ? (
                  <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs">
                    {logs.join("\n")}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">No logs</p>
                )}
              </div>

              {job.failedReason && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-red-600 uppercase">
                    Error
                  </h4>
                  <pre className="max-h-40 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800">
                    {job.failedReason}
                    {job.stacktrace.length > 0 &&
                      "\n\n" + job.stacktrace.join("\n")}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Job list card ──────────────────────────────────────────────────

function JobListCard({
  title,
  description,
  jobs,
  emptyMessage,
}: {
  title: string;
  description?: string;
  jobs: SerializedJob[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <span className="text-muted-foreground text-2xl font-bold">
            {jobs.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6 px-2" />
                  <TableHead>TMK / Job</TableHead>
                  <TableHead className="w-28">Started</TableHead>
                  <TableHead className="w-20">Duration</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <JobRow key={`${job.queue}-${job.id}`} job={job} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export default function QpubScraperPanel({
  initialQueueData,
  initialDbStats,
}: {
  initialQueueData: QpubScraperStatus;
  initialDbStats: QpubDbStats;
}) {
  const [queueData, setQueueData] = useState(initialQueueData);
  const [dbStats, setDbStats] = useState(initialDbStats);
  const [lastQueueUpdate, setLastQueueUpdate] = useState(() => new Date());
  const [lastDbUpdate, setLastDbUpdate] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();
  const [isSeeding, startSeedTransition] = useTransition();
  const [isDraining, startDrainTransition] = useTransition();
  const [drainMessage, setDrainMessage] = useState<string | null>(null);

  const hasActive = (queueData.counts.active ?? 0) > 0 || (queueData.counts.waiting ?? 0) > 0;
  const waiting = (queueData.counts.waiting ?? 0) + (queueData.counts.delayed ?? 0);

  // Split jobs by state
  const activeJobs = queueData.jobs.filter((j) => j.state === "active");
  const completedJobs = queueData.jobs.filter((j) => j.state === "completed");
  const failedJobs = queueData.jobs.filter((j) => j.state === "failed");

  const refreshQueue = useCallback(() => {
    startTransition(async () => {
      const result = await getQpubScraperStatus();
      setQueueData(result);
      setLastQueueUpdate(new Date());
    });
  }, []);

  const refreshDb = useCallback(async () => {
    const result = await getQpubDbStats();
    setDbStats(result);
    setLastDbUpdate(new Date());
  }, []);

  // Queue poll: 10s when active, 30s otherwise
  useEffect(() => {
    const interval = setInterval(refreshQueue, hasActive ? 10_000 : 30_000);
    return () => clearInterval(interval);
  }, [hasActive, refreshQueue]);

  // DB stats poll: every 60s
  useEffect(() => {
    const interval = setInterval(refreshDb, 60_000);
    return () => clearInterval(interval);
  }, [refreshDb]);

  function handleSeed() {
    startSeedTransition(async () => {
      await seedQpubScraper();
      refreshQueue();
    });
  }

  function handleDrainAndReseed() {
    if (!confirm("This will wipe all scraper jobs and reseed from the database. Continue?")) {
      return;
    }
    setDrainMessage(null);
    startDrainTransition(async () => {
      const removed = await drainScraperQueue();
      setDrainMessage(`Drained ${removed} jobs. Reseeding...`);
      await seedQpubScraper();
      setDrainMessage(null);
      refreshQueue();
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {waiting > 0 && (
            <span className="rounded-md border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-sm font-medium text-yellow-700">
              {formatNumber(waiting)} waiting
            </span>
          )}
          {queueData.workers.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {queueData.workers.length} worker{queueData.workers.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Queue: {formatTime(lastQueueUpdate)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshQueue}
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
            onClick={handleSeed}
            disabled={isSeeding}
          >
            {isSeeding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Seed
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDrainAndReseed}
            disabled={isDraining}
          >
            {isDraining ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Drain & Reseed
          </Button>
        </div>
      </div>

      {/* Drain status message */}
      {drainMessage && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          {drainMessage}
        </div>
      )}

      {/* 4-section grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Section 1: DB pipeline stats */}
        <DbStatsCard stats={dbStats} lastUpdated={lastDbUpdate} />

        {/* Section 2: Active jobs */}
        <JobListCard
          title="Active"
          description={`${queueData.counts.active ?? 0} jobs currently processing`}
          jobs={activeJobs}
          emptyMessage="No active jobs."
        />

        {/* Section 3: Completed jobs */}
        <JobListCard
          title="Completed"
          description={`${formatNumber(queueData.counts.completed ?? 0)} total`}
          jobs={completedJobs}
          emptyMessage="No completed jobs in queue."
        />

        {/* Section 4: Failed jobs */}
        <JobListCard
          title="Failed"
          description={`${formatNumber(queueData.counts.failed ?? 0)} total`}
          jobs={failedJobs}
          emptyMessage="No failed jobs."
        />
      </div>
    </div>
  );
}
