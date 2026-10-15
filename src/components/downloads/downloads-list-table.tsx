"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  DomainGroup,
  DownloadSummary,
} from "@catalog/controllers/downloads";
import { Ban, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteDownloadAction,
  downloadToServer,
} from "@/actions/download-actions";
import { DeleteDownloadDialog } from "@/components/downloads/delete-download-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

function DownloadRow({
  dl,
  universe,
}: {
  dl: DownloadSummary;
  universe: string;
}) {
  const router = useRouter();
  const isOrphan = !dl.hasRelatedSeries && !dl.dateSensitive;
  const [isDownloading, startDownload] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function handleDownloadToServer() {
    startDownload(async () => {
      try {
        const result = await downloadToServer(dl.id);
        if (result.status === 200) {
          toast.success(
            result.changed
              ? `${dl.handle}: Downloaded — file content changed`
              : `${dl.handle}: Downloaded — no changes detected`,
          );
        } else {
          toast.warning(
            `${dl.handle}: Download returned status ${result.status}`,
          );
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Download failed");
      }
    });
  }

  async function handleDestroy() {
    try {
      const result = await deleteDownloadAction(dl.id);
      toast.success(result.message);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <TableRow>
      <TableCell className="max-w-[280px] truncate font-mono text-sm">
        <span
          className={isOrphan ? "text-destructive" : ""}
          title={isOrphan ? `orphaned: ${dl.handle}` : (dl.handle ?? "")}
        >
          <Link
            href={`/udaman/${universe}/downloads/${dl.id}`}
            className="hover:underline"
          >
            {dl.handle ?? "-"}
          </Link>
        </span>
        {dl.freezeFile && (
          <span title="Frozen">
            <Ban className="text-destructive ml-1 inline size-3.5" />
          </span>
        )}
      </TableCell>
      <TableCell>
        <Link
          href={`/udaman/${universe}/downloads/${dl.id}/edit`}
          className="text-muted-foreground text-xs hover:underline"
        >
          edit
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/udaman/${universe}/downloads/${dl.id}/duplicate`}
          className="text-muted-foreground text-xs hover:underline"
        >
          duplicate
        </Link>
      </TableCell>
      <TableCell>
        <button
          className="text-destructive cursor-pointer text-xs hover:underline"
          onClick={() => setShowDeleteDialog(true)}
        >
          destroy
        </button>
        <DeleteDownloadDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          handle={dl.handle}
          onConfirm={handleDestroy}
        />
      </TableCell>
      <TableCell>
        <button
          className="text-muted-foreground cursor-pointer text-xs hover:underline disabled:cursor-wait disabled:opacity-50"
          disabled={isDownloading}
          onClick={handleDownloadToServer}
        >
          {isDownloading ? (
            <Loader2 className="inline size-3 animate-spin" />
          ) : (
            "download-to-server"
          )}
        </button>
      </TableCell>
      <TableCell>
        {dl.url ? (
          <a
            href={dl.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground text-xs hover:underline"
          >
            download-to-user
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DownloadsListTable({ domains }: { domains: DomainGroup[] }) {
  const params = useParams();
  const universe = params.universe as string;
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const allOpen = openSet.size === domains.length;

  function toggleAll() {
    if (allOpen) {
      setOpenSet(new Set());
    } else {
      setOpenSet(new Set(domains.map((g) => g.domain)));
    }
  }

  function toggleDomain(domain: string) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      {domains.map((group) => {
        const orphanCount = group.downloads.filter(
          (d) => !d.hasRelatedSeries && !d.dateSensitive,
        ).length;

        return (
          <Collapsible
            key={group.domain}
            open={openSet.has(group.domain)}
            onOpenChange={() => toggleDomain(group.domain)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="bg-muted/50 h-auto w-full justify-between py-2 text-left"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">
                    {group.domain}
                  </span>
                  <div className="text-muted-foreground text-xs font-normal">
                    <span>{group.downloads.length} downloads</span>
                    {orphanCount > 0 && (
                      <span className="text-destructive ml-2">
                        {orphanCount} orphan{orphanCount !== 1 && "s"}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronsUpDown className="size-4 shrink-0" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableBody>
                  {group.downloads.map((dl) => (
                    <DownloadRow key={dl.id} dl={dl} universe={universe} />
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
