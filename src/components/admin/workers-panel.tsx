"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import {
  getJobLogs,
  getWorkerJobs,
  type JobState,
  type SerializedJob,
  type SerializedWorkerInfo,
  type WorkerJobsResult,
} from "@/actions/workers";
import { Button } from "@/components/ui/button";
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
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  const remMin = min % 60;
  if (hrs < 24) return `${hrs}h ${remMin}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
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

// ─── Summary counts ─────────────────────────────────────────────────

function SummaryCounts({
  counts,
}: {
  counts: Record<string, Record<string, number>>;
}) {
  const totals: Record<string, number> = {};
  for (const queueCounts of Object.values(counts)) {
    for (const [state, count] of Object.entries(queueCounts)) {
      totals[state] = (totals[state] ?? 0) + count;
    }
  }

  const states: { key: string; label: string; color: string }[] = [
    {
      key: "active",
      label: "Active",
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      key: "waiting",
      label: "Waiting",
      color: "text-yellow-700 bg-yellow-50 border-yellow-200",
    },
    {
      key: "delayed",
      label: "Delayed",
      color: "text-orange-700 bg-orange-50 border-orange-200",
    },
    {
      key: "completed",
      label: "Completed",
      color: "text-green-700 bg-green-50 border-green-200",
    },
    {
      key: "failed",
      label: "Failed",
      color: "text-red-700 bg-red-50 border-red-200",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {states.map(({ key, label, color }) => (
        <div
          key={key}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${color}`}
        >
          {label}: {totals[key] ?? 0}
        </div>
      ))}
    </div>
  );
}

// ─── Worker processes table ─────────────────────────────────────────

function WorkerProcesses({ workers }: { workers: SerializedWorkerInfo[] }) {
  if (workers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No active worker processes detected.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Queue</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Client Name</TableHead>
            <TableHead className="w-24">Uptime</TableHead>
            <TableHead className="w-24">Idle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((w) => (
            <TableRow key={`${w.queue}-${w.id}`}>
              <TableCell className="text-muted-foreground text-xs">
                {w.queue}
              </TableCell>
              <TableCell className="font-mono text-sm">{w.addr}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {w.name}
              </TableCell>
              <TableCell className="text-xs">{formatUptime(w.age)}</TableCell>
              <TableCell className="text-xs">{formatUptime(w.idle)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Expandable job row ─────────────────────────────────────────────

function JobRow({ job }: { job: SerializedJob }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

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
        <TableCell className="w-8 px-2">
          {expanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {job.queue}
        </TableCell>
        <TableCell className="font-mono text-sm">{job.name}</TableCell>
        <TableCell>
          <StateBadge state={job.state} />
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
            <span className="text-green-700">{String(job.returnvalue)}</span>
          ) : null}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="space-y-3">
              {/* Job data */}
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Job Data
                </h4>
                <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                  {JSON.stringify(job.data, null, 2)}
                </pre>
              </div>

              {/* Logs */}
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

              {/* Error / stacktrace */}
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

// ─── Main panel ─────────────────────────────────────────────────────

export default function WorkersPanel({
  initialData,
}: {
  initialData: WorkerJobsResult;
}) {
  const [data, setData] = useState(initialData);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();

  const hasActive = Object.values(data.counts).some((c) => (c.active ?? 0) > 0);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getWorkerJobs();
      setData(result);
      setLastUpdated(new Date());
    });
  }, []);

  // Poll every 5s when jobs are active, 30s otherwise
  useEffect(() => {
    const interval = setInterval(refresh, hasActive ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [hasActive, refresh]);

  return (
    <div className="space-y-4">
      {/* Summary + refresh */}
      <div className="flex items-center justify-between">
        <SummaryCounts counts={data.counts} />
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Worker processes */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Worker Processes ({data.workers.length})
        </h2>
        <WorkerProcesses workers={data.workers} />
      </section>

      {/* Job table */}
      {data.jobs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No jobs found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2" />
                <TableHead className="w-20">Queue</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">Started</TableHead>
                <TableHead className="w-24">Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.map((job) => (
                <JobRow key={`${job.queue}-${job.id}`} job={job} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
