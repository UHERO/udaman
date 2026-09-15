"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { formatHst } from "@catalog/utils/time";
import { Eraser, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

import {
  clearPendingRecords,
  clearStaleScrapers,
  getQpubDashboardStats,
  resetFailedRecords,
  type CountyProgress,
  type FailedRecord,
  type QpubDashboardStats,
  type ScraperInstance,
  type StageProgress,
} from "@/actions/crawlers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ────────────────────────────────────────────────────────

/** For true instants (client refresh time) — rendered as Hawaii clock time. */
function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    timeZone: "Pacific/Honolulu",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function fmt(n: number): string {
  return n.toLocaleString();
}

/** For DB DATETIME values (HST wall-clock), e.g. record updated_at. */
function formatDate(dateStr: string): string {
  return formatHst(dateStr, "MMM d, h:mm a");
}

/** Compact duration, e.g. "3d 4h", "2h 15m", "45s". */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ─── Section shell ──────────────────────────────────────────────────

/** A titled region of the page. Regions are divided by Separators, not cards. */
function Section({
  title,
  titleSuffix,
  children,
}: {
  title: string;
  titleSuffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">
        {title}
        {titleSuffix ? <> {titleSuffix}</> : null}
      </h2>
      {children}
    </section>
  );
}

// ─── Progress bar ───────────────────────────────────────────────────

function ProgressBar({
  percent,
  className = "bg-blue-500",
  height = "h-2",
}: {
  percent: number;
  className?: string;
  height?: string;
}) {
  return (
    <div className={`bg-muted ${height} overflow-hidden rounded-full`}>
      <div
        className={`h-full rounded-full transition-all ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

// ─── County scrape progress ─────────────────────────────────────────

function CountyRow({ county }: { county: CountyProgress }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 shrink-0 font-medium">{county.name}</span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums">
        {county.percent}%
      </span>
      <div className="flex-1">
        <ProgressBar percent={county.percent} />
      </div>
      <span className="text-muted-foreground w-36 shrink-0 text-right text-xs tabular-nums">
        {fmt(county.scraped)} / {fmt(county.total)}
      </span>
    </div>
  );
}

// ─── Stage progress (parse / load) ──────────────────────────────────

function StageRow({
  label,
  stage,
  color,
}: {
  label: string;
  stage: StageProgress;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {fmt(stage.success)} / {fmt(stage.total)} ({stage.percent}%)
        </span>
      </div>
      <ProgressBar percent={stage.percent} className={color} />
      <div className="flex gap-3 text-xs">
        <span className="text-yellow-700">{fmt(stage.pending)} pending</span>
        <span className="text-green-700">{fmt(stage.success)} done</span>
        <span className="text-red-700">{fmt(stage.failed)} failed</span>
      </div>
    </div>
  );
}

// ─── Scraper instances ──────────────────────────────────────────────

/** Mirrors MAX_CONSECUTIVE_CAPTCHAS in scrape-runner.ts (worker-only module). */
const MAX_CONSECUTIVE_CAPTCHAS = 3;

const STATE_STYLES: Record<string, string> = {
  scraping: "bg-green-100 text-green-800",
  // The long backoff is the one that warrants going and looking at the machine,
  // so it reads louder than the routine short pause.
  "captcha-sleep": "bg-red-200 font-semibold text-red-900",
  "captcha-pause": "bg-orange-100 text-orange-800",
  // The runner has exited: it couldn't write scraped HTML to the NAS.
  "storage-error": "bg-red-200 font-semibold text-red-900",
  // The runner has exited: the browser wouldn't launch.
  "browser-error": "bg-red-200 font-semibold text-red-900",
  sleeping: "bg-blue-100 text-blue-800",
  "blocked-window": "bg-blue-100 text-blue-800",
  idle: "bg-gray-100 text-gray-800",
  starting: "bg-yellow-100 text-yellow-800",
};

function ScraperInstances({
  instances,
  onClearStale,
  isClearingStale,
}: {
  instances: ScraperInstance[];
  onClearStale: () => void;
  isClearingStale: boolean;
}) {
  const active = instances.filter((i) => i.active);
  const staleCount = instances.length - active.length;
  const captchaStuck = active.filter((i) => i.state === "captcha-sleep");
  // A halted runner stops heartbeating, so it goes inactive within a couple of
  // minutes — search all instances, not just the active ones.
  const storageStuck = instances.filter((i) => i.state === "storage-error");
  const browserStuck = instances.filter((i) => i.state === "browser-error");

  return (
    <Section
      title="Scrapers"
      titleSuffix={
        <>
          <span
            className={
              active.length > 0
                ? "font-normal text-green-700"
                : "text-muted-foreground font-normal"
            }
          >
            ({active.length} active)
          </span>
          {staleCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="ml-3 h-7"
              onClick={onClearStale}
              disabled={isClearingStale}
            >
              {isClearingStale ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Clear Stale ({staleCount})
            </Button>
          )}
        </>
      }
    >
      {browserStuck.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {browserStuck.map((i) => i.workerName).join(", ")} stopped — the
          browser would not launch. Re-run{" "}
          <code className="rounded bg-red-100 px-1 py-0.5 text-xs">
            bunx playwright install
          </code>{" "}
          on{" "}
          {browserStuck.length === 1 ? "that machine" : "those machines"} and
          restart the scraper.
        </div>
      )}
      {storageStuck.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {storageStuck.map((i) => i.workerName).join(", ")} stopped — could not
          save scraped HTML. Check the NAS mount on{" "}
          {storageStuck.length === 1 ? "that machine" : "those machines"} and
          restart the scraper.
        </div>
      )}
      {captchaStuck.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {captchaStuck.length === 1
            ? `${captchaStuck[0].workerName} hit ${MAX_CONSECUTIVE_CAPTCHAS} captchas in a row and is sleeping`
            : `${captchaStuck.length} workers hit ${MAX_CONSECUTIVE_CAPTCHAS} captchas in a row and are sleeping`}
          {" — worth checking the machine."}
        </div>
      )}
      {instances.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No scrapers reporting in. Start one with{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            bun run scraper
          </code>
          .
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Scraped</TableHead>
              <TableHead className="text-right">Captchas</TableHead>
              <TableHead className="text-right">Uptime</TableHead>
              <TableHead className="text-right">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((i) => (
              <TableRow
                key={i.id}
                className={i.active ? undefined : "opacity-50"}
              >
                <TableCell className="text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        i.active ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {i.workerName}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      STATE_STYLES[i.state] ?? "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {/* A storage error is why the worker stopped; showing it
                        as "stale" would hide the one thing worth reading. */}
                    {i.active ||
                    i.state === "storage-error" ||
                    i.state === "browser-error"
                      ? i.state
                      : "stale"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-60 truncate text-xs">
                  {i.detail || "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {fmt(i.scrapedCount)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {i.captchaCount > 0 ? (
                    <span className="text-red-700">{fmt(i.captchaCount)}</span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatDuration(i.uptimeSeconds)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatDuration(i.lastSeenSeconds)} ago
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
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
      <Section title="Recent Failures">
        <p className="text-muted-foreground text-sm">No failed records.</p>
      </Section>
    );
  }

  return (
    <Section
      title="Recent Failures"
      titleSuffix={
        <span className="text-muted-foreground font-normal">
          ({records.length})
        </span>
      }
    >
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
    </Section>
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
  const [isClearingStale, startClearStaleTransition] = useTransition();
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

  function handleClearStale() {
    setActionMessage(null);
    startClearStaleTransition(async () => {
      const count = await clearStaleScrapers();
      setActionMessage(`Cleared ${count} stale scraper records`);
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
    <div className="space-y-5">
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

      <Separator />

      {/* Running scrapers */}
      <ScraperInstances
        instances={stats.instances}
        onClearStale={handleClearStale}
        isClearingStale={isClearingStale}
      />

      <Separator />

      {/* Scrape progress — overall, then per county alongside the counters */}
      <Section title="Scrape Progress">
        <div className="space-y-2">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold">{stats.scrapePercent}%</span>
            <span className="text-muted-foreground pb-1 text-sm">
              {fmt(stats.freshScrapes)} / {fmt(stats.totalRecords)} scraped in
              the last 6 months
            </span>
          </div>
          <ProgressBar percent={stats.scrapePercent} height="h-2.5" />
        </div>

        <div className="flex flex-col gap-6 pt-1 md:flex-row md:items-stretch">
          <div className="flex-1 space-y-2">
            {stats.counties.map((c) => (
              <CountyRow key={c.islandCode} county={c} />
            ))}
          </div>

          <Separator orientation="vertical" className="hidden md:block" />

          <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-3 md:w-56">
            <Stat label="Today" value={fmt(stats.scrapedToday)} />
            <Stat label="This Month" value={fmt(stats.scrapedThisMonth)} />
            <Stat label="In Progress" value={fmt(stats.scrape.pending)} />
            <Stat label="Scrape Failures" value={fmt(stats.scrape.failed)} />
          </div>
        </div>
      </Section>

      <Separator />

      {/* Downstream batch passes */}
      <Section title="Parse & Load">
        <div className="space-y-4">
          <StageRow label="Parse" stage={stats.parse} color="bg-violet-500" />
          <StageRow label="Load" stage={stats.load} color="bg-green-500" />
        </div>
      </Section>

      <Separator />

      {/* Failed Records */}
      <FailedRecordsTable records={stats.recentFailures} />
    </div>
  );
}
