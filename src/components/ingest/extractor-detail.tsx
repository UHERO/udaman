"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ExtractorDetail } from "@catalog/controllers/ingest";
import { formatHst } from "@catalog/utils/time";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";

import {
  acceptRunAction,
  extractNowAction,
  releaseClaimAction,
} from "@/actions/ingest-actions";
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

import { StatsList, StatusBadge, useIngestAction } from "./shared";

function RunButtons({ detail }: { detail: ExtractorDetail }) {
  const { pending, run } = useIngestAction();
  const e = detail.extractor;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending || !e.enabled}
        title="Parse the stored inputs (skipped when nothing changed since the last ok run)"
        onClick={() => run(() => extractNowAction(e.handle))}
      >
        {pending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
        Extract now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !e.enabled}
        title="Parse even if the inputs are unchanged"
        onClick={() => run(() => extractNowAction(e.handle, { force: true }))}
      >
        Force re-parse
      </Button>
      {e.runningSince && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => releaseClaimAction("extractor", e.handle))}
        >
          Release run claim (since {formatHst(e.runningSince)})
        </Button>
      )}
    </div>
  );
}

function AcceptButton({ runId }: { runId: number }) {
  const { pending, run } = useIngestAction();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      title="Publish this run despite its soft failures: loads will read it"
      onClick={() => run(() => acceptRunAction(runId))}
    >
      {pending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
      Accept run #{runId}
    </Button>
  );
}

function RunDetail({ detail }: { detail: ExtractorDetail }) {
  const r = detail.run;
  if (!r) {
    return (
      <p className="text-muted-foreground text-sm">
        No extraction run yet. Fetch an input downloader, or extract now.
      </p>
    );
  }
  const isServing = detail.serving?.id === r.id;
  const failed = r.validationResults.filter((v) => !v.passed);
  const passed = r.validationResults.filter((v) => v.passed);
  return (
    <section className="flex flex-col gap-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">Extraction run #{r.id}</h3>
        <StatusBadge status={r.status} accepted={Boolean(r.acceptedAt)} />
        {isServing && <Badge variant="outline">loads read this run</Badge>}
        <span className="text-muted-foreground text-sm">
          {formatHst(r.startedAt)} · {r.triggeredBy ?? "-"}
          {r.fetchRunId ? ` · after fetch run #${r.fetchRunId}` : ""}
        </span>
        {detail.canAccept && <AcceptButton runId={r.id} />}
      </div>
      {r.status === "unchanged" && (
        <p className="text-muted-foreground text-sm">
          The inputs matched the last ok run, so nothing was parsed.
        </p>
      )}
      {r.status === "failed" && r.error && !r.outputPath && (
        <p className="text-destructive text-sm">{r.error}</p>
      )}
      {r.outputPath && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            {r.seriesCount} series · {r.rowCount} rows
          </span>
          <a
            href={`/api/ingest/extractions/${r.id}`}
            className="text-muted-foreground hover:underline"
          >
            download extract
          </a>
          {detail.missing &&
            Object.values(detail.missing.counts).some((n) => n > 0) && (
              <a
                href={`/api/ingest/extractions/${r.id}?file=missing`}
                className="text-muted-foreground hover:underline"
              >
                download missing periods
              </a>
            )}
        </div>
      )}

      {r.validationResults.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">Checks</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {[...failed, ...passed].map((v) => (
              <li key={v.check}>
                <div className="flex items-start gap-2">
                  {v.passed ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                  ) : (
                    <CircleX className="text-destructive mt-0.5 size-4 shrink-0" />
                  )}
                  <span>
                    <span className="font-mono text-xs">{v.check}</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      ({v.severity})
                    </span>{" "}
                    {v.message}
                  </span>
                </div>
                {v.details && v.details.length > 0 && (
                  <details className="ml-6">
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      {v.details.length} detail(s)
                    </summary>
                    <ul className="mt-1 font-mono text-xs">
                      {v.details.map((d, i) => (
                        <li key={i}>
                          {typeof d === "string" ? d : JSON.stringify(d)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(r.stats).length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Stats</summary>
          <div className="mt-2">
            <StatsList stats={r.stats} />
          </div>
        </details>
      )}

      {detail.missing &&
        Object.values(detail.missing.counts).some((n) => n > 0) && (
          <details>
            <summary className="cursor-pointer text-sm">
              Missing periods: {detail.missing.counts.blank} blank in the source
              · {detail.missing.counts.absent} not reported ·{" "}
              {detail.missing.counts.failed} unreadable (waived)
            </summary>
            <p className="text-muted-foreground mt-2 text-xs">
              Periods inside a series&apos; range without a value. Blank: the
              source printed the row with no value. Not reported: the
              period&apos;s file was read but has no such row. Unreadable: the
              period could not be read and a known issue waived it (unwaived
              ones fail the run).
            </p>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  {detail.dimensions.map((d) => (
                    <TableHead key={d}>{d}</TableHead>
                  ))}
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.missing.sample.map((m, i) => (
                  <TableRow key={i}>
                    {detail.dimensions.map((d) => (
                      <TableCell key={d} className="text-xs">
                        {m.dims[d]}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs whitespace-nowrap">
                      {m.date}
                    </TableCell>
                    <TableCell className="text-xs">{m.reason}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[420px] text-xs">
                      {m.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        )}
    </section>
  );
}

export function ExtractorDetailView({ detail }: { detail: ExtractorDetail }) {
  const universe = useParams().universe as string;
  const e = detail.extractor;
  const example = `Series.load_from_extract("${e.handle}", { ${detail.dimensions
    .filter((d) => d !== "frequency")
    .map((d) => `${d}: "…"`)
    .join(", ")} })`;
  return (
    <div className="flex max-w-[1200px] flex-col gap-6">
      <RunButtons detail={detail} />

      <section className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">Parser</span>
        <span className="font-mono">{e.sourceKey}</span>
        <span className="text-muted-foreground">Reads</span>
        <span className="font-mono">
          {detail.inputs.map((i, n) => (
            <span key={i.downloaderId}>
              {n > 0 && ", "}
              <Link
                href={`/udaman/${universe}/ingest/downloaders/${i.downloaderHandle}`}
                className="hover:underline"
              >
                {i.downloaderHandle}
              </Link>
              {i.role ? ` (${i.role})` : ""}
            </span>
          ))}
        </span>
        <span className="text-muted-foreground">Dimensions</span>
        <span className="font-mono">{detail.dimensions.join(", ")}</span>
        <span className="text-muted-foreground">Load statement</span>
        <code className="text-xs">{example}</code>
        <span className="text-muted-foreground">Loads read</span>
        <span>
          {detail.serving
            ? `run #${detail.serving.id} (${detail.serving.seriesCount} series, ${formatHst(detail.serving.finishedAt)})`
            : "nothing yet: no ok run"}
        </span>
        {Object.keys(e.config).length > 0 && (
          <>
            <span className="text-muted-foreground">Config</span>
            <pre className="bg-muted max-w-[700px] overflow-auto rounded p-2 text-xs">
              {JSON.stringify(e.config, null, 2)}
            </pre>
          </>
        )}
        {e.notes && (
          <>
            <span className="text-muted-foreground">Notes</span>
            <span>{e.notes}</span>
          </>
        )}
      </section>

      <RunDetail detail={detail} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Extraction runs</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Series</TableHead>
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
                  {detail.serving?.id === r.id && (
                    <Badge variant="outline" className="ml-2">
                      serving
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={r.status}
                    accepted={Boolean(r.acceptedAt)}
                  />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatHst(r.startedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {r.triggeredBy ?? "-"}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {r.seriesCount != null
                    ? `${r.seriesCount} (${r.rowCount} rows)`
                    : "-"}
                </TableCell>
                <TableCell
                  className="text-destructive max-w-[420px] truncate text-xs"
                  title={r.error ?? undefined}
                >
                  {r.status === "failed" ? r.error : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
