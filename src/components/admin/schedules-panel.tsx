"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";

import {
  getSchedulers,
  removeScheduler,
  triggerScheduledJob,
  type SerializedScheduler,
} from "@/actions/workers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function formatRelative(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return "overdue";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `in ${min}m`;
  const hrs = Math.floor(min / 60);
  const remMin = min % 60;
  if (hrs < 24) return `in ${hrs}h ${remMin}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d ${hrs % 24}h`;
}

// ─── Schedule row with actions ──────────────────────────────────────

function ScheduleRow({
  scheduler,
  onAction,
}: {
  scheduler: SerializedScheduler;
  onAction: () => void;
}) {
  const [acting, setActing] = useState(false);

  async function handleRunNow() {
    setActing(true);
    try {
      await triggerScheduledJob(
        scheduler.queue,
        scheduler.name,
        scheduler.data,
      );
      onAction();
    } finally {
      setActing(false);
    }
  }

  async function handleDisable() {
    setActing(true);
    try {
      await removeScheduler(scheduler.queue, scheduler.key);
      onAction();
    } finally {
      setActing(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-xs">
        {scheduler.queue}
      </TableCell>
      <TableCell className="font-mono text-sm">{scheduler.name}</TableCell>
      <TableCell className="font-mono text-xs">{scheduler.pattern}</TableCell>
      <TableCell className="text-xs">{scheduler.tz}</TableCell>
      <TableCell className="text-xs">
        {formatDate(scheduler.next)}
        <span className="text-muted-foreground ml-1.5">
          ({formatRelative(scheduler.next)})
        </span>
      </TableCell>
      <TableCell className="w-12">
        {acting ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRunNow}>
                <Play className="mr-2 h-3.5 w-3.5" />
                Run Now
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDisable}
                className="text-destructive focus:text-destructive"
              >
                <Pause className="mr-2 h-3.5 w-3.5" />
                Disable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────

export default function SchedulesPanel({
  initialData,
}: {
  initialData: SerializedScheduler[];
}) {
  const [schedulers, setSchedulers] = useState(initialData);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getSchedulers();
      setSchedulers(result);
      setLastUpdated(new Date());
    });
  }

  // Poll every 30s to keep next-run times and schedule list current
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <h2 className="text-sm font-semibold">
            {schedulers.length} Scheduled Job
            {schedulers.length !== 1 ? "s" : ""}
          </h2>
        </div>
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
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {schedulers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No scheduled jobs.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Queue</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Cron</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulers.map((s) => (
                <ScheduleRow key={s.key} scheduler={s} onAction={refresh} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
