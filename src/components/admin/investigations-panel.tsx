"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AdminAction,
  EnrichedReloadJob,
} from "@catalog/collections/reload-job-collection";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { deleteReloadJob, runAdminAction } from "@/actions/investigations";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LoadError = {
  lastError: string;
  seriesId: number;
  count: number;
};

const ADMIN_ACTIONS: { action: AdminAction; label: string }[] = [
  { action: "export_tsd", label: "Generate TSD Export" },
  { action: "restart_rest", label: "Restart REST API" },
  { action: "restart_dvw", label: "Restart DVW API" },
  { action: "clear_cache", label: "Clear API Cache" },
  { action: "update_public", label: "Update public data points" },
  { action: "sync_nas", label: "Sync files from NAS" },
];

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

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const mon = SHORT_MONTHS[d.getMonth()];
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mon} ${day}, ${hh}:${mm}`;
}

function formatDuration(
  start: Date | string | null,
  end: Date | string | null,
): string {
  if (!start || !end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  processing: "bg-blue-100 text-blue-800",
  waiting: "bg-yellow-100 text-yellow-800",
};

function StatusBadge({ status }: { status: string | null }) {
  const display = status ?? "waiting";
  const colors = STATUS_COLORS[display] ?? STATUS_COLORS.waiting;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {display}
    </span>
  );
}

function SeriesList({ names }: { names: string[] }) {
  if (names.length === 0)
    return <span className="text-muted-foreground">-</span>;
  const display = names.slice(0, 3);
  const more = names.length > 3 ? ` +${names.length - 3} more` : "";
  return (
    <span className="text-xs">
      {display.join(", ")}
      {more && <span className="text-muted-foreground">{more}</span>}
    </span>
  );
}

export default function InvestigationsPanel({
  loadErrors,
  reloadJobs,
}: {
  loadErrors: LoadError[];
  reloadJobs: EnrichedReloadJob[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<AdminAction | null>(null);

  function handleAdminAction(action: AdminAction, label: string) {
    setActiveAction(action);
    startTransition(async () => {
      try {
        const result = await runAdminAction(action);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Failed: ${label}`);
      } finally {
        setActiveAction(null);
      }
    });
  }

  function handleDeleteJob(id: number) {
    startTransition(async () => {
      try {
        const result = await deleteReloadJob(id);
        toast.success(result.message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete job");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Admin Actions */}
      <section>
        <h2 className="text-lg font-semibold">Admin Actions</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          System maintenance and administration tasks.
        </p>
        <div className="flex flex-wrap gap-2">
          {ADMIN_ACTIONS.map(({ action, label }) => {
            const isActive = activeAction === action;
            return (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleAdminAction(action, label)}
              >
                {isActive && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Reload Jobs */}
      <section>
        <h2 className="text-lg font-semibold">User Reload Jobs</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Recent reload jobs submitted by users (excludes system/cron jobs).
        </p>
        {reloadJobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reload jobs found.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Id</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-16 text-right">Count</TableHead>
                  <TableHead>Series</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reloadJobs
                  .slice(0, 5)
                  .map(({ job, username, seriesNames, seriesCount }) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">
                        {job.id}
                      </TableCell>
                      <TableCell className="text-sm">{username}</TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(job.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDuration(job.createdAt, job.finishedAt)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {seriesCount}
                      </TableCell>
                      <TableCell>
                        <SeriesList names={seriesNames} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-red-600">
                        {job.error}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeleteJob(job.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Load Errors */}
      <section>
        <h2 className="text-lg font-semibold">Current Load Errors</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Active UHERO loader errors grouped by error message.
        </p>
        {loadErrors.length === 0 ? (
          <p className="text-muted-foreground text-sm">No load errors.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 text-right">Count</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadErrors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-right font-mono">
                      {err.count}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/udaman/UHERO/series/${err.seriesId}`}
                        className="text-sm hover:underline"
                      >
                        {err.lastError}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
