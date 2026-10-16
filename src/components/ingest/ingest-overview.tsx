"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  DownloaderSummary,
  ExtractorSummary,
  IngestOverview,
} from "@catalog/controllers/ingest";
import { formatHst } from "@catalog/utils/time";
import { Loader2 } from "lucide-react";

import { extractNowAction, fetchNowAction } from "@/actions/ingest-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatBytes, StatusBadge, useIngestAction } from "./shared";

function RunLink({
  label,
  disabled,
  onRun,
}: {
  label: string;
  disabled: boolean;
  onRun: (run: ReturnType<typeof useIngestAction>["run"]) => void;
}) {
  const { pending, run } = useIngestAction();
  return (
    <button
      className="text-muted-foreground cursor-pointer text-xs hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending || disabled}
      onClick={() => onRun(run)}
    >
      {pending ? <Loader2 className="inline size-3 animate-spin" /> : label}
    </button>
  );
}

function DownloadersTable({ rows }: { rows: DownloaderSummary[] }) {
  const universe = useParams().universe as string;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Downloader</TableHead>
          <TableHead>Fetch</TableHead>
          <TableHead>Schedule (HST)</TableHead>
          <TableHead>Stored</TableHead>
          <TableHead>Last fetch</TableHead>
          <TableHead>Feeds</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-mono text-sm">
              <Link
                href={`/udaman/${universe}/ingest/downloaders/${d.handle}`}
                className="hover:underline"
              >
                {d.handle}
              </Link>
              {!d.enabled && (
                <Badge variant="secondary" className="ml-2">
                  disabled
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {d.strategy}
              {d.sourceKey ? ` · ${d.sourceKey}` : ""}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {d.schedule ?? "manual"}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
              {d.keys > 0
                ? `${d.keys} keys · ${d.vintages} vintages · ${formatBytes(d.bytes)}`
                : "nothing yet"}
            </TableCell>
            <TableCell className="max-w-[320px]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={d.lastFetch?.status} />
                <span className="text-xs whitespace-nowrap">
                  {formatHst(d.lastFetch?.startedAt)}
                </span>
                {d.lastFetch?.error && (
                  <span
                    className="text-destructive truncate text-xs"
                    title={d.lastFetch.error}
                  >
                    {d.lastFetch.error}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {d.extractors.join(", ") || "-"}
            </TableCell>
            <TableCell>
              <RunLink
                label="fetch"
                disabled={!d.enabled}
                onRun={(run) => run(() => fetchNowAction(d.handle))}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ExtractorsTable({ rows }: { rows: ExtractorSummary[] }) {
  const universe = useParams().universe as string;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Extractor</TableHead>
          <TableHead>Reads</TableHead>
          <TableHead>Dimensions</TableHead>
          <TableHead>Loads read</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-mono text-sm">
              <Link
                href={`/udaman/${universe}/ingest/extractors/${e.handle}`}
                className="hover:underline"
              >
                {e.handle}
              </Link>
              {!e.enabled && (
                <Badge variant="secondary" className="ml-2">
                  disabled
                </Badge>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {e.inputs.map((i) => i.downloaderHandle).join(", ")}
            </TableCell>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {e.dimensions.join(", ")}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {e.serving
                ? `run #${e.serving.id} · ${e.serving.seriesCount} series · ${formatHst(e.serving.finishedAt)}`
                : "no ok output yet"}
            </TableCell>
            <TableCell className="max-w-[320px]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={e.lastRun?.status}
                  accepted={Boolean(e.lastRun?.acceptedAt)}
                />
                {e.lastRun && (
                  <span className="text-xs whitespace-nowrap">
                    #{e.lastRun.id} {formatHst(e.lastRun.startedAt)}
                  </span>
                )}
                {e.lastRun?.status === "failed" && e.lastRun.error && (
                  <span
                    className="text-destructive truncate text-xs"
                    title={e.lastRun.error}
                  >
                    {e.lastRun.error}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <RunLink
                label="extract"
                disabled={!e.enabled}
                onRun={(run) => run(() => extractNowAction(e.handle))}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function IngestOverviewView({ overview }: { overview: IngestOverview }) {
  const universe = useParams().universe as string;
  return (
    <div className="flex max-w-[1200px] flex-col gap-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Downloaders</h2>
          <Link
            href={`/udaman/${universe}/ingest/downloaders/new`}
            className="text-sm hover:underline"
          >
            New downloader
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Fetch raw files and store them unchanged, one row per distinct version
          (vintage). A fetch runs the extractors that read it.
        </p>
        <DownloadersTable rows={overview.downloaders} />
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Extractors</h2>
          <Link
            href={`/udaman/${universe}/ingest/extractors/new`}
            className="text-sm hover:underline"
          >
            New extractor
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Parse stored files into series by dimension. Load statements read the
          latest ok run:{" "}
          <code className="text-xs">
            Series.load_from_extract(&quot;handle&quot;, {"{"} dimension:
            &quot;label&quot; {"}"})
          </code>
          . Runs never trigger reloads.
        </p>
        <ExtractorsTable rows={overview.extractors} />
      </section>
    </div>
  );
}
