"use client";

import { useState } from "react";
import { formatHst } from "@catalog/utils/time";
import { ChevronDown } from "lucide-react";

import type { SerializedLoaderAction } from "@/actions/loader-actions";
import { getColor } from "@/components/helpers";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTimestamp(iso: string): string {
  return formatHst(iso, "MMM d, yyyy HH:mm");
}

export function LoaderActionHistory({
  actions,
}: {
  actions: SerializedLoaderAction[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        Loader History
        <span className="text-muted-foreground text-xs font-normal">
          ({actions.length})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {actions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No loader history</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Action</TableHead>
                  <TableHead className="w-40">User</TableHead>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead>Eval</TableHead>
                  <TableHead className="w-20">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getColor(a.color) ?? "bg-muted"} text-xs`}
                      >
                        {a.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.userEmail ?? (a.userId ? `#${a.userId}` : "-")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatTimestamp(a.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {a.eval ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.priority ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
