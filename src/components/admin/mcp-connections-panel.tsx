"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActiveTokenRow } from "@catalog/collections/oauth-access-token-collection";
import { formatHst } from "@catalog/utils/time";
import { Ban, UserX } from "lucide-react";
import { toast } from "sonner";

import { revokeMcpToken, revokeMcpTokensForUser } from "@/actions/oauth-tokens";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Rows carry naive Hawaii wall-clock strings; formatHst takes those as-is. */
function formatStamp(wallClock: string | null): string {
  if (!wallClock) return "-";
  return formatHst(wallClock, "MMM d, yyyy h:mm a");
}

type PendingRevoke =
  | { kind: "one"; token: ActiveTokenRow }
  | { kind: "user"; token: ActiveTokenRow; count: number };

/**
 * Live Claude (MCP) connections: one row per unexpired, unrevoked OAuth
 * access token. Revoking takes effect on the token's next request. A user
 * can reconnect at any time by going through the OAuth flow again, so this
 * is a "kick them out now" control, not a ban.
 */
export default function McpConnectionsPanel({
  tokens,
}: {
  tokens: ActiveTokenRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<PendingRevoke | null>(null);

  const countByUser = new Map<number, number>();
  for (const t of tokens) {
    countByUser.set(t.userId, (countByUser.get(t.userId) ?? 0) + 1);
  }

  function confirmRevoke() {
    const target = pending;
    if (!target) return;
    startTransition(async () => {
      const result =
        target.kind === "one"
          ? await revokeMcpToken(target.token.id)
          : await revokeMcpTokensForUser(target.token.userId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setPending(null);
    });
  }

  const ownerLabel = (t: ActiveTokenRow) => t.userEmail ?? t.tokenEmail;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {tokens.length} active connection{tokens.length !== 1 && "s"}.
          Revoking ends access immediately; the user can reconnect from Claude.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[110px] text-right">Revoke</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => {
              const userCount = countByUser.get(t.userId) ?? 0;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.userName || "-"}
                    {t.userEmail === null && (
                      <span className="text-destructive ml-2 text-xs">
                        (account deleted)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{ownerLabel(t)}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-default text-sm underline decoration-dotted underline-offset-4">
                          {t.clientName || "Unnamed client"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-mono text-xs">{t.clientId}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {formatStamp(t.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">
                      {formatStamp(t.expiresAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer"
                      aria-label={`Revoke connection for ${ownerLabel(t)}`}
                      disabled={isPending}
                      onClick={() => setPending({ kind: "one", token: t })}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                    {userCount > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Revoke all ${userCount} connections for ${ownerLabel(t)}`}
                            disabled={isPending}
                            onClick={() =>
                              setPending({
                                kind: "user",
                                token: t,
                                count: userCount,
                              })
                            }
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Revoke all {userCount} for this user
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {tokens.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No active MCP connections.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "user"
                ? "Revoke all connections?"
                : "Revoke connection?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "user"
                ? `This ends all ${pending.count} of ${ownerLabel(pending.token)}'s Claude connections now.`
                : pending
                  ? `This ends ${ownerLabel(pending.token)}'s connection from ${pending.token.clientName || "this client"} now.`
                  : ""}{" "}
              They can reconnect from Claude at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRevoke();
              }}
              disabled={isPending}
            >
              {isPending ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
