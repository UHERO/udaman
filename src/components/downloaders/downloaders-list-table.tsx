"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { DownloaderSummary } from "@catalog/controllers/downloaders";
import { formatHst } from "@catalog/utils/time";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { runDownloaderAction } from "@/actions/downloader-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function RunButton({ d }: { d: DownloaderSummary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="text-muted-foreground cursor-pointer text-xs hover:underline disabled:cursor-wait disabled:opacity-50"
      disabled={pending || !d.enabled}
      onClick={() =>
        start(async () => {
          try {
            const res = await runDownloaderAction(d.id);
            toast.success(res.message);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Run failed");
          }
        })
      }
    >
      {pending ? <Loader2 className="inline size-3 animate-spin" /> : "run"}
    </button>
  );
}

export function DownloadersListTable({
  downloaders,
}: {
  downloaders: DownloaderSummary[];
}) {
  const params = useParams();
  const universe = params.universe as string;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Downloader</TableHead>
          <TableHead>Load method</TableHead>
          <TableHead>Last success</TableHead>
          <TableHead>Last change</TableHead>
          <TableHead>Sources</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {downloaders.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-mono text-sm">
              <Link
                href={`/udaman/${universe}/downloaders/${d.id}`}
                className="hover:underline"
              >
                {d.handle}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[340px] truncate font-mono text-xs">
              {d.loadSignature ?? "(no implementation)"}
            </TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              {formatHst(d.lastSuccessAt)}
            </TableCell>
            <TableCell className="text-sm whitespace-nowrap">
              {formatHst(d.lastChangeAt)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {d.sourceCount > 0
                ? `${d.sourceCount} (${d.historicalCount} historical)`
                : "-"}
            </TableCell>
            <TableCell className="max-w-[280px]">
              <div className="flex flex-wrap items-center gap-1">
                {!d.enabled && <Badge variant="secondary">disabled</Badge>}
                {d.runningSince && <Badge variant="outline">running</Badge>}
                {d.lastError ? (
                  <span
                    className="text-destructive truncate text-xs"
                    title={d.lastError}
                  >
                    {d.lastError}
                  </span>
                ) : (
                  d.lastRunAt && <Badge variant="outline">ok</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <RunButton d={d} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
