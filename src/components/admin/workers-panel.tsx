"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";

import {
  clearJobs,
  getJobLogs,
  getWorkerJobs,
  type JobState,
  type SerializedJob,
  type SerializedScheduler,
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

function formatRelativeTime(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "now";
  const totalSec = Math.floor(diff / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  const hrs = Math.floor(min / 60);
  if (hrs === 0) return `${min}m`;
  return `${hrs}h ${min % 60}m`;
}

function jobTimestamp(job: SerializedJob): number {
  return job.processedOn ?? job.timestamp;
}

// ─── Status badge ───────────────────────────────────────────────────

const STATE_STYLES: Record<JobState, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  waiting: "bg-yellow-100 text-yellow-800",
  delayed: "bg-orange-100 text-orange-800",
};

const DOT_COLORS: Record<JobState, string> = {
  active: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  waiting: "bg-yellow-500",
  delayed: "bg-orange-500",
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

function StatusDot({ state }: { state: JobState }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[state]}${state === "active" ? " animate-pulse" : ""}`}
    />
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

function WorkerProcesses({
  workers,
  processStartedAt,
}: {
  workers: SerializedWorkerInfo[];
  processStartedAt: number | null;
}) {
  if (workers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No active worker processes detected.
      </p>
    );
  }

  const uptimeStr = processStartedAt
    ? formatUptime(Math.floor((Date.now() - processStartedAt) / 1000))
    : null;

  return (
    <div className="space-y-2">
      {uptimeStr && (
        <p className="text-muted-foreground text-sm">
          Process uptime: <span className="text-foreground font-medium">{uptimeStr}</span>
        </p>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Queue</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Client Name</TableHead>
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
                <TableCell className="text-xs">{formatUptime(w.idle)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Job detail panel (right side of expanded row) ──────────────────

function JobDetail({
  job,
  logs,
  loadingLogs,
}: {
  job: SerializedJob;
  logs: string[] | null;
  loadingLogs: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
          Job Data
          <span className="text-muted-foreground ml-3 font-normal normal-case">
            Queue: {job.queue}
          </span>
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
  );
}

// ─── Grouped job row ────────────────────────────────────────────────

type JobGroup = {
  name: string;
  /** Jobs that have executed or are executing (active/completed/failed) */
  runs: SerializedJob[];
  /** Jobs pending execution (delayed/waiting) */
  queued: SerializedJob[];
  nextRun: number | null;
};

function isRun(job: SerializedJob): boolean {
  return job.state === "active" || job.state === "completed" || job.state === "failed";
}

function JobGroupRow({ group }: { group: JobGroup }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const logsCache = useRef<Record<string, string[]>>({});
  const [currentLogs, setCurrentLogs] = useState<string[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const latestRun = group.runs[0] ?? null;
  const recentRuns = group.runs.slice(0, 5);
  const allJobs = [...group.runs, ...group.queued];

  const selectedJob = selectedJobId
    ? allJobs.find((j) => j.id === selectedJobId) ?? latestRun
    : latestRun;

  async function loadLogsForJob(job: SerializedJob) {
    if (logsCache.current[job.id]) {
      setCurrentLogs(logsCache.current[job.id]);
      return;
    }
    setLoadingLogs(true);
    try {
      const result = await getJobLogs(job.queue, job.id);
      logsCache.current[job.id] = result;
      setCurrentLogs(result);
    } catch {
      setCurrentLogs(["Failed to load logs"]);
    } finally {
      setLoadingLogs(false);
    }
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && latestRun) {
      setSelectedJobId(latestRun.id);
      loadLogsForJob(latestRun);
    }
  }

  function handleSelectJob(job: SerializedJob) {
    setSelectedJobId(job.id);
    loadLogsForJob(job);
  }

  // Use the latest actual run for summary info, fall back to first queued job
  const summaryJob = latestRun ?? group.queued[0];
  if (!summaryJob) return null;

  const latestDuration = latestRun
    ? latestRun.state === "active"
      ? formatDuration(latestRun.processedOn, Date.now())
      : formatDuration(latestRun.processedOn, latestRun.finishedOn)
    : "";

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
        <TableCell>
          {summaryJob.data.name ? (
            <div>
              <div className="text-sm">{String(summaryJob.data.name)}</div>
              <div className="text-muted-foreground font-mono text-xs">
                {group.name}
              </div>
            </div>
          ) : (
            <span className="font-mono text-sm">{group.name}</span>
          )}
          <span className="text-muted-foreground ml-2 text-xs">
            {group.runs.length > 1 && `${group.runs.length} runs`}
            {group.runs.length > 1 && group.queued.length > 0 && ", "}
            {group.queued.length > 0 &&
              `${group.queued.length} queued`}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {group.nextRun ? (
            <span title={formatDate(group.nextRun)}>
              in {formatRelativeTime(group.nextRun)}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="text-xs">
          {latestRun ? formatDate(jobTimestamp(latestRun)) : ""}
        </TableCell>
        <TableCell>
          {latestRun ? (
            <StateBadge state={latestRun.state} />
          ) : (
            <StateBadge state={summaryJob.state} />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">{latestDuration}</TableCell>
        <TableCell className="max-w-xs truncate text-xs">
          {latestRun?.failedReason ? (
            <span className="text-red-600">{latestRun.failedReason}</span>
          ) : latestRun?.state === "completed" && latestRun.returnvalue ? (
            <span className="text-green-700">{String(latestRun.returnvalue)}</span>
          ) : null}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="flex gap-4">
              {/* Left: recent runs list */}
              <div className="w-56 shrink-0 space-y-1">
                {group.queued.length > 0 && (
                  <>
                    <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                      Queued
                    </h4>
                    {group.queued.map((job) => {
                      const isSelected = selectedJob && job.id === selectedJob.id;
                      return (
                        <button
                          key={job.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectJob(job);
                          }}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-muted ring-ring ring-1"
                              : "hover:bg-muted/60"
                          }`}
                        >
                          <StatusDot state={job.state} />
                          <span className="flex-1 truncate">
                            {formatDate(job.timestamp)}
                          </span>
                          <span className="text-muted-foreground">
                            {job.state}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
                <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                  Recent Runs
                </h4>
                {recentRuns.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No runs yet</p>
                ) : (
                  recentRuns.map((job) => {
                    const isSelected = selectedJob && job.id === selectedJob.id;
                    const dur =
                      job.state === "active"
                        ? formatDuration(job.processedOn, Date.now())
                        : formatDuration(job.processedOn, job.finishedOn);
                    return (
                      <button
                        key={job.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectJob(job);
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-muted ring-ring ring-1"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <StatusDot state={job.state} />
                        <span className="flex-1 truncate">
                          {formatDate(jobTimestamp(job))}
                        </span>
                        {dur && (
                          <span className="text-muted-foreground font-mono">
                            {dur}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right: detail for selected job */}
              <div className="min-w-0 flex-1">
                {selectedJob ? (
                  <JobDetail
                    job={selectedJob}
                    logs={currentLogs}
                    loadingLogs={loadingLogs}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a run to view details
                  </p>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Grouping logic ─────────────────────────────────────────────────

function buildJobGroups(
  jobs: SerializedJob[],
  schedulers: SerializedScheduler[],
): JobGroup[] {
  // Group jobs by name, splitting into runs vs queued
  const runMap = new Map<string, SerializedJob[]>();
  const queuedMap = new Map<string, SerializedJob[]>();
  for (const job of jobs) {
    const map = isRun(job) ? runMap : queuedMap;
    const existing = map.get(job.name);
    if (existing) {
      existing.push(job);
    } else {
      map.set(job.name, [job]);
    }
  }

  // Sort runs newest-first, queued by timestamp asc (earliest first)
  for (const runs of runMap.values()) {
    runs.sort((a, b) => jobTimestamp(b) - jobTimestamp(a));
  }
  for (const queued of queuedMap.values()) {
    queued.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Build scheduler next-run map (earliest next per name)
  const schedulerNextMap = new Map<string, number>();
  for (const s of schedulers) {
    if (s.next > 0) {
      const existing = schedulerNextMap.get(s.name);
      if (!existing || s.next < existing) {
        schedulerNextMap.set(s.name, s.next);
      }
    }
  }

  // Collect all group names
  const allNames = new Set([...runMap.keys(), ...queuedMap.keys()]);

  // Build groups array
  const groups: JobGroup[] = [];
  for (const name of allNames) {
    const runs = runMap.get(name) ?? [];
    const queued = queuedMap.get(name) ?? [];

    // Prefer earliest queued job timestamp for "next run" (it's already in the queue),
    // fall back to scheduler's next time
    const queuedNext = queued.length > 0 ? queued[0].timestamp : null;
    const schedulerNext = schedulerNextMap.get(name) ?? null;
    const nextRun = queuedNext ?? schedulerNext;

    groups.push({ name, runs, queued, nextRun });
  }

  // Sort: active runs first, then by latest run timestamp desc
  groups.sort((a, b) => {
    const aActive = a.runs.some((j) => j.state === "active");
    const bActive = b.runs.some((j) => j.state === "active");
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aTs = a.runs[0] ? jobTimestamp(a.runs[0]) : 0;
    const bTs = b.runs[0] ? jobTimestamp(b.runs[0]) : 0;
    return bTs - aTs;
  });

  return groups;
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

  const handleClear = useCallback(() => {
    startTransition(async () => {
      await clearJobs();
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

  const groups = useMemo(
    () => buildJobGroups(data.jobs, data.schedulers),
    [data.jobs, data.schedulers],
  );

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
            onClick={handleClear}
            disabled={isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
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
        <WorkerProcesses workers={data.workers} processStartedAt={data.processStartedAt} />
      </section>

      {/* Grouped job table */}
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">No jobs found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2" />
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Next Run</TableHead>
                <TableHead className="w-32">Last Run</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24">Duration</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <JobGroupRow key={group.name} group={group} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
