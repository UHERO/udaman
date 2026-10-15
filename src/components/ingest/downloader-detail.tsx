"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { DownloaderDetail } from "@catalog/controllers/ingest";
import { formatHst } from "@catalog/utils/time";
import { Loader2 } from "lucide-react";

import { fetchNowAction, releaseClaimAction } from "@/actions/ingest-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatBytes, StatsList, StatusBadge, useIngestAction } from "./shared";

function RunButtons({ detail }: { detail: DownloaderDetail }) {
  const { pending, run } = useIngestAction();
  const d = detail.downloader;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending || !d.enabled}
        onClick={() => run(() => fetchNowAction(d.handle))}
      >
        {pending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
        Fetch now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !d.enabled}
        title="Refetch even where the source's shortcut says nothing changed"
        onClick={() => run(() => fetchNowAction(d.handle, { force: true }))}
      >
        Force fetch
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !d.enabled}
        title="Also refetch keys marked final (e.g. every DOTAX archive zip)"
        onClick={() => run(() => fetchNowAction(d.handle, { full: true }))}
      >
        Full refetch
      </Button>
      {d.runningSince && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title="Clear a claim left by a crashed run"
          onClick={() => run(() => releaseClaimAction("downloader", d.handle))}
        >
          Release run claim (since {formatHst(d.runningSince)})
        </Button>
      )}
    </div>
  );
}

function RunDetail({ detail }: { detail: DownloaderDetail }) {
  const r = detail.run;
  if (!r) return null;
  const { keysFailed, warnings, ...rest } = r.stats as {
    keysFailed?: Array<{ key: string; message: string }>;
    warnings?: string[];
  };
  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">Fetch run #{r.id}</h3>
        <StatusBadge status={r.status} />
        <span className="text-muted-foreground text-sm">
          {formatHst(r.startedAt)} · {r.triggeredBy ?? "-"}
        </span>
      </div>
      {r.error && <p className="text-destructive text-sm">{r.error}</p>}
      <StatsList stats={rest} />
      {keysFailed && keysFailed.length > 0 && (
        <div>
          <h4 className="text-destructive text-sm font-semibold">
            Keys that failed
          </h4>
          <ul className="text-destructive mt-1 list-disc pl-5 font-mono text-xs">
            {keysFailed.map((k) => (
              <li key={k.key}>
                {k.key}: {k.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Warnings</h4>
          <ul className="text-muted-foreground mt-1 list-disc pl-5 font-mono text-xs">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {detail.runArtifacts.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">
            {detail.runArtifacts.length} artifact(s) stored or seen,{" "}
            {detail.runArtifacts.filter((a) => a.changed).length} new
          </summary>
          <ul className="mt-2 font-mono text-xs">
            {detail.runArtifacts.map(({ artifact, changed }) => (
              <li key={artifact.id}>
                {changed ? "new  " : "same "}
                {artifact.artifactKey}{" "}
                <span className="text-muted-foreground">
                  {artifact.contentHash.slice(0, 12)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function DownloaderDetailView({ detail }: { detail: DownloaderDetail }) {
  const universe = useParams().universe as string;
  const d = detail.downloader;
  return (
    <div className="flex max-w-[1200px] flex-col gap-6">
      <RunButtons detail={detail} />

      <section className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">Strategy</span>
        <span className="font-mono">
          {d.strategy}
          {d.sourceKey ? ` (source module ${d.sourceKey})` : ""}
        </span>
        <span className="text-muted-foreground">Schedule</span>
        <span className="font-mono">
          {d.schedule
            ? `${d.schedule} (Hawaii time, production only)`
            : "manual only"}
        </span>
        {d.schedule && (
          <>
            <span className="text-muted-foreground">Next</span>
            <span className="font-mono">
              {detail.nextRun
                ? formatHst(detail.nextRun, "EEE yyyy-MM-dd HH:mm")
                : d.enabled
                  ? "not a valid schedule"
                  : "none (disabled)"}
            </span>
          </>
        )}
        <span className="text-muted-foreground">Feeds</span>
        <span className="font-mono">
          {detail.extractors.length
            ? detail.extractors.map((h, i) => (
                <span key={h}>
                  {i > 0 && ", "}
                  <Link
                    href={`/udaman/${universe}/ingest/extractors/${h}`}
                    className="hover:underline"
                  >
                    {h}
                  </Link>
                </span>
              ))
            : "no extractor reads it"}
        </span>
        <span className="text-muted-foreground">Config</span>
        <pre className="bg-muted max-w-[700px] overflow-auto rounded p-2 text-xs">
          {JSON.stringify(d.config, null, 2)}
        </pre>
        {Object.keys(d.state).length > 0 && (
          <>
            <span className="text-muted-foreground">State</span>
            <details>
              <summary className="cursor-pointer text-xs">
                {Object.keys(d.state).join(", ")}
              </summary>
              <pre className="bg-muted max-h-64 max-w-[700px] overflow-auto rounded p-2 text-xs">
                {JSON.stringify(d.state, null, 2)}
              </pre>
            </details>
          </>
        )}
        {d.notes && (
          <>
            <span className="text-muted-foreground">Notes</span>
            <span>{d.notes}</span>
          </>
        )}
      </section>

      <RunDetail detail={detail} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Fetch runs</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Artifacts</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.runs.map((r) => (
              <TableRow
                key={r.id}
                className={detail.run?.id === r.id ? "bg-muted" : undefined}
              >
                <TableCell className="font-mono text-sm">
                  <Link href={`?run=${r.id}`} className="hover:underline">
                    #{r.id}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatHst(r.startedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.triggeredBy ?? "-"}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {r.stats.artifacts != null
                    ? `${String(r.stats.artifacts)} (${String(r.stats.newVintages ?? 0)} new)`
                    : "-"}
                </TableCell>
                <TableCell
                  className="text-destructive max-w-[420px] truncate text-xs"
                  title={r.error ?? undefined}
                >
                  {r.error}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">
          Stored files{" "}
          <span className="text-muted-foreground text-sm font-normal">
            newest version of each key
            {detail.artifactCount > detail.artifacts.length &&
              ` (latest ${detail.artifacts.length} of ${detail.artifactCount})`}
          </span>
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Versions</TableHead>
              <TableHead>First fetched</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.artifacts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">
                  {a.artifactKey}
                  {a.final && (
                    <Badge
                      variant="secondary"
                      className="ml-2"
                      title="Never refetched"
                    >
                      final
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[260px] truncate text-xs">
                  {a.resolvedUrl ? (
                    <a
                      href={a.resolvedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      title={a.resolvedUrl}
                    >
                      {a.originalName ?? a.resolvedUrl}
                    </a>
                  ) : (
                    (a.originalName ?? "-")
                  )}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatBytes(a.size)}
                </TableCell>
                <TableCell className="text-xs">{a.vintages}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatHst(a.fetchedAt)}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatHst(a.lastSeenAt)}
                </TableCell>
                <TableCell>
                  <a
                    href={`/api/ingest/artifacts/${a.id}`}
                    className="text-muted-foreground text-xs hover:underline"
                  >
                    download
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
