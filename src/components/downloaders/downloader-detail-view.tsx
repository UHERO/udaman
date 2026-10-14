"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  DownloaderDetail,
  DownloadRef,
} from "@catalog/controllers/downloaders";
import { formatHst } from "@catalog/utils/time";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  releaseDownloaderClaimAction,
  runDownloaderAction,
  setDownloadHistoricalAction,
} from "@/actions/downloader-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ message: string }>) =>
    start(async () => {
      try {
        const res = await fn();
        toast.success(res.message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  return { pending, run };
}

function HistoricalToggle({ dl }: { dl: DownloadRef }) {
  const { pending, run } = useAction();
  return (
    <Switch
      checked={dl.historical}
      disabled={pending}
      onCheckedChange={(v) => run(() => setDownloadHistoricalAction(dl.id, v))}
      aria-label="historical"
    />
  );
}

function RunButtons({ detail }: { detail: DownloaderDetail }) {
  const { pending, run } = useAction();
  const d = detail.downloader;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending || !d.enabled}
        onClick={() => run(() => runDownloaderAction(d.id))}
      >
        {pending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
        Run now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !d.enabled}
        title="Re-parse even if nothing changed"
        onClick={() => run(() => runDownloaderAction(d.id, { force: true }))}
      >
        Force re-parse
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !d.enabled}
        title="Ignore historical marks and history state: refetch everything"
        onClick={() => run(() => runDownloaderAction(d.id, { full: true }))}
      >
        Force full refetch
      </Button>
      {d.runningSince && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title="Clear a claim left by a crashed run"
          onClick={() => run(() => releaseDownloaderClaimAction(d.id))}
        >
          Release run claim ({formatHst(d.runningSince)})
        </Button>
      )}
    </div>
  );
}

function Stats({ stats }: { stats: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const { problems, ...rest } = stats as { problems?: string[] };
  const scalar = Object.entries(rest).filter(
    ([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v),
  );
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
        {scalar.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono">{String(v)}</dd>
          </div>
        ))}
      </dl>
      {problems && problems.length > 0 && (
        <div>
          <h3 className="text-destructive text-sm font-semibold">
            Open problems
          </h3>
          <ul className="text-destructive mt-1 list-disc pl-5 font-mono text-xs">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        className="text-muted-foreground text-xs hover:underline"
        onClick={() => setOpen(!open)}
      >
        {open ? "hide" : "show"} raw stats
      </button>
      {open && (
        <pre className="bg-muted max-h-80 overflow-auto rounded p-2 text-xs">
          {JSON.stringify(stats, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function DownloaderDetailView({
  detail,
  universe,
}: {
  detail: DownloaderDetail;
  universe: string;
}) {
  const d = detail.downloader;
  const [showAllSources, setShowAllSources] = useState(false);
  const sources = showAllSources ? detail.sources : detail.sources.slice(0, 50);
  const missing = detail.refs.filter(
    (r) => r.error || r.keys.some((k) => !k.found),
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <RunButtons detail={detail} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold">Last run</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
            <dt className="text-muted-foreground">last run</dt>
            <dd>
              {formatHst(d.lastRunAt)}
              {d.lastRunSeconds != null && ` (${d.lastRunSeconds.toFixed(1)}s)`}
            </dd>
            <dt className="text-muted-foreground">last success</dt>
            <dd>{formatHst(d.lastSuccessAt)}</dd>
            <dt className="text-muted-foreground">last change</dt>
            <dd>{formatHst(d.lastChangeAt)}</dd>
            <dt className="text-muted-foreground">max age</dt>
            <dd>
              {d.maxAgeMinutes == null
                ? "schedule only"
                : `${d.maxAgeMinutes} min (refreshed at load time when older)`}
            </dd>
            {detail.historyComplete != null && (
              <>
                <dt className="text-muted-foreground">full history loaded</dt>
                <dd>{detail.historyComplete} series</dd>
              </>
            )}
          </dl>
          {d.lastError && (
            <p className="text-destructive mt-2 text-sm whitespace-pre-wrap">
              {formatHst(d.lastErrorAt)}: {d.lastError}
            </p>
          )}
          <div className="mt-3">
            <Stats stats={d.lastStats} />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Load method</h2>
            <code className="bg-muted mt-1 block rounded px-2 py-1 text-xs">
              Series.{d.loadSignature ?? "(no implementation registered)"}
            </code>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Output</h2>
            {detail.output ? (
              <p className="mt-1 text-sm">
                <Link
                  href={`/udaman/${universe}/downloads/${detail.output.id}`}
                  className="font-mono hover:underline"
                >
                  {detail.output.handle}
                </Link>{" "}
                — {detail.output.keyCount} keys, {detail.output.rowCount} rows,
                refreshed {formatHst(detail.output.lastDownloadAt)}, changed{" "}
                {formatHst(detail.output.lastChangeAt)}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">
                Not run yet ({d.outputHandle})
              </p>
            )}
            <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
              cache: {detail.cacheDir}
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Config</h2>
            <pre className="bg-muted mt-1 rounded p-2 text-xs">
              {JSON.stringify(d.config, null, 2)}
            </pre>
          </div>
          {d.notes && (
            <div>
              <h2 className="text-xl font-semibold">Notes</h2>
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                {d.notes}
              </p>
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-xl font-semibold">
          Load statements{" "}
          <span className="text-muted-foreground text-sm font-normal">
            {detail.refs.length} using {d.handle}
            {missing > 0 && (
              <span className="text-destructive"> · {missing} unresolved</span>
            )}
          </span>
        </h2>
        {detail.refs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Series</TableHead>
                <TableHead>Eval</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>In output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.refs.map((r) => (
                <TableRow key={r.loaderId}>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {r.seriesId ? (
                      <Link
                        href={`/udaman/${universe}/series/${r.seriesId}`}
                        className="hover:underline"
                      >
                        {r.seriesName}
                      </Link>
                    ) : (
                      `loader ${r.loaderId}`
                    )}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[420px] truncate font-mono text-xs"
                    title={r.eval}
                  >
                    {r.eval}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.error ? (
                      <span className="text-destructive">{r.error}</span>
                    ) : (
                      r.keys.map((k) => k.key).join(", ")
                    )}
                  </TableCell>
                  <TableCell>
                    {!r.error &&
                      (r.keys.every((k) => k.found) ? (
                        <CircleCheck className="size-4 text-emerald-600" />
                      ) : (
                        <span title="not in the output yet">
                          <CircleX className="text-destructive size-4" />
                        </span>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {detail.sources.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">
            Source files{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {detail.sources.length} ·{" "}
              {detail.sources.filter((s) => s.historical).length} historical
              (never refetched)
            </span>
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Download</TableHead>
                <TableHead>Last download</TableHead>
                <TableHead>Last change</TableHead>
                <TableHead>Historical</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/udaman/${universe}/downloads/${s.id}`}
                      className="hover:underline"
                      title={s.url ?? ""}
                    >
                      {s.handle}
                    </Link>
                    {s.notes && (
                      <span className="text-muted-foreground ml-2">
                        {s.notes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatHst(s.lastDownloadAt)}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatHst(s.lastChangeAt)}
                  </TableCell>
                  <TableCell>
                    <HistoricalToggle dl={s} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {detail.sources.length > 50 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllSources(!showAllSources)}
            >
              {showAllSources
                ? "Show fewer"
                : `Show all ${detail.sources.length}`}
            </Button>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Recent runs</h2>
        {detail.runs.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">
            No worker runs logged yet (CLI and load-time runs show only in the
            status above).
          </p>
        ) : (
          <Table>
            <TableBody>
              {detail.runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatHst(r.at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "failed" ? "destructive" : "outline"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.runMs != null ? `${(r.runMs / 1000).toFixed(1)}s` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
