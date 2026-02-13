"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronsUpDown, Ban } from "lucide-react";
import { toast } from "sonner";

import type { DomainGroup, DownloadSummary } from "@catalog/controllers/downloads";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

function DownloadRow({
  dl,
  universe,
}: {
  dl: DownloadSummary;
  universe: string;
}) {
  const isOrphan = !dl.hasRelatedSeries && !dl.dateSensitive;

  return (
    <TableRow>
      <TableCell className="max-w-[280px] truncate font-mono text-sm">
        <span className={isOrphan ? "text-destructive" : ""} title={isOrphan ? `orphaned: ${dl.handle}` : dl.handle ?? ""}>
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
          href={`/udaman/${universe}/downloads/${dl.id}`}
          className="text-muted-foreground text-xs hover:underline"
        >
          edit
        </Link>
      </TableCell>
      <TableCell>
        <button
          className="text-muted-foreground cursor-pointer text-xs hover:underline"
          onClick={() => toast.info("Not yet implemented")}
        >
          duplicate
        </button>
      </TableCell>
      <TableCell>
        <button
          className="text-destructive cursor-pointer text-xs hover:underline"
          onClick={() => toast.info("Not yet implemented")}
        >
          destroy
        </button>
      </TableCell>
      <TableCell>
        <button
          className="text-muted-foreground cursor-pointer text-xs hover:underline"
          onClick={() => toast.info("Not yet implemented")}
        >
          download-to-server
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
                <span className="text-base font-semibold">{group.domain}</span>
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
