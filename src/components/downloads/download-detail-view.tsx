"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RelatedSeries } from "@catalog/collections/download-collection";
import type {
  DownloadDetail,
  LogEntrySerialized,
} from "@catalog/controllers/downloads";
import { format } from "date-fns";
import {
  ArrowRightLeft,
  CircleAlert,
  CircleCheck,
  CircleX,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { downloadToServer } from "@/actions/download-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return format(new Date(iso), "yyyy-MM-dd");
}

/** Group log entries by URL, preserving order */
function groupByUrl(entries: LogEntrySerialized[]) {
  const groups: { url: string; entries: LogEntrySerialized[] }[] = [];
  let current: (typeof groups)[number] | null = null;

  for (const entry of entries) {
    const url = entry.url ?? "(no url)";
    if (!current || current.url !== url) {
      current = { url, entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }
  return groups;
}

function StatusIcon({ status }: { status: number | null }) {
  if (status == null)
    return <span className="text-muted-foreground mx-auto text-xs">-</span>;
  if (status === 200)
    return (
      <span title="200 OK">
        <CircleCheck className="mx-auto size-4 text-emerald-600" />
      </span>
    );
  if (status === 301 || status === 302)
    return (
      <span title={`${status} Redirect`}>
        <RefreshCw className="mx-auto size-4 text-sky-600" />
      </span>
    );
  if (status === 403)
    return (
      <span title="403 Forbidden">
        <ShieldAlert className="mx-auto size-4 text-amber-600" />
      </span>
    );
  if (status === 404)
    return (
      <span title="404 Not Found">
        <CircleX className="text-destructive mx-auto size-4" />
      </span>
    );
  if (status >= 500)
    return (
      <span title={`${status} Server Error`}>
        <CircleAlert className="text-destructive mx-auto size-4" />
      </span>
    );
  return (
    <span
      title={`${status}`}
      className="text-destructive mx-auto text-xs font-medium"
    >
      {status}
    </span>
  );
}

function LogSection({ entries }: { entries: LogEntrySerialized[] }) {
  if (entries.length === 0) return null;
  const groups = groupByUrl(entries);

  return (
    <section>
      <h2 className="text-xl font-semibold">Download log</h2>
      {groups.map((group, i) => (
        <div key={i} className="mt-3">
          <a
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground mb-1 block max-w-56 text-xs text-balance break-words hover:underline"
          >
            {group.url}
          </a>
          <Table className="w-auto">
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="h-min">Date</TableHead>
                <TableHead className="h-min">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground py-1 pr-2 text-sm whitespace-nowrap">
                    {formatDate(entry.time)}
                  </TableCell>
                  <TableCell className="mx- py-1">
                    <StatusIcon status={entry.status} />
                  </TableCell>
                  <TableCell className="py-1">
                    {entry.dlChanged && (
                      <span title="Changed">
                        <ArrowRightLeft className="size-4 text-sky-700" />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </section>
  );
}

function SeriesSection({
  series,
  universe,
}: {
  series: RelatedSeries[];
  universe: string;
}) {
  if (series.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-semibold">Series</h2>
      <Table>
        <TableBody>
          {series.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-sm">
                <Link
                  href={`/udaman/${universe}/series/${s.id}`}
                  className="hover:underline"
                >
                  {s.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {s.aremos_diff != null ? `diff: ${s.aremos_diff}` : ""}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {s.aremos_missing != null ? `missing: ${s.aremos_missing}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function DownloadDetailView({
  detail,
  universe,
}: {
  detail: DownloadDetail;
  universe: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDownloadToServer() {
    startTransition(async () => {
      try {
        const result = await downloadToServer(detail.id);
        if (result.status === 200) {
          toast.success(
            result.changed
              ? "Downloaded — file content changed"
              : "Downloaded — no changes detected",
          );
        } else {
          toast.warning(`Download returned status ${result.status}`);
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Download failed");
      }
    });
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-8">
      {/* Left column: Download log */}
      <LogSection entries={detail.logEntries} />

      {/* Right column: Details */}
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="text-xl font-semibold">Server file location</h2>
          <a
            href={`/api/data-file/${detail.savePathRelative}`}
            className="text-muted-foreground mt-1 block font-mono text-sm break-all hover:underline"
          >
            {detail.savePath}
          </a>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Click to download the server&apos;s saved copy
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Source links</h2>
          <div className="mt-1 flex flex-col gap-1">
            <button
              className="w-fit cursor-pointer text-sm hover:underline disabled:cursor-wait disabled:opacity-50"
              disabled={isPending}
              onClick={handleDownloadToServer}
            >
              {isPending && (
                <Loader2 className="mr-1 inline size-3.5 animate-spin" />
              )}
              download-to-server
            </button>
            {detail.url ? (
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit text-sm hover:underline"
              >
                download-to-user
              </a>
            ) : (
              <span className="text-muted-foreground text-sm">No URL set</span>
            )}
          </div>
        </section>

        {detail.notes && (
          <section>
            <h2 className="text-xl font-semibold">Notes</h2>
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
              {detail.notes}
            </p>
          </section>
        )}

        <SeriesSection series={detail.relatedSeries} universe={universe} />
      </div>
    </div>
  );
}
