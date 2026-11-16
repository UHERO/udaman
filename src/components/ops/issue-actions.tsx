"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  assignIssueAction,
  commentOnIssueAction,
  dismissIssueAction,
  reopenIssueAction,
  resolveIssueAction,
  snoozeIssueAction,
} from "@/actions/ops";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function IssueActions({
  issueId,
  status,
  takenByMe,
  taken,
  isDev,
}: {
  issueId: number;
  status: string;
  takenByMe: boolean;
  taken: boolean;
  isDev: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<Result>, clear = false) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        if (clear) setText("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });

  const live = [
    "open",
    "investigating",
    "awaiting_human",
    "resolving",
  ].includes(status);

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comment, answer the agent's question, or describe what you fixed…"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending || !text.trim()}
          onClick={() => act(() => commentOnIssueAction(issueId, text), true)}
        >
          Comment
        </Button>
        {live && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            title="Re-checks the condition; resolves only if it's gone"
            onClick={() => act(() => resolveIssueAction(issueId, text), true)}
          >
            Resolve (re-check)
          </Button>
        )}
        {live && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              act(
                () =>
                  snoozeIssueAction(issueId, 7, text || "Snoozed from the app"),
                true,
              )
            }
          >
            Snooze 7 days
          </Button>
        )}
        {live && (!taken || takenByMe) && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => act(() => assignIssueAction(issueId, !takenByMe))}
          >
            {takenByMe ? "Release to agent" : "Take it (agent stays away)"}
          </Button>
        )}
        {isDev && live && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending || !text.trim()}
            title="Not a problem; needs a reason in the box"
            onClick={() => act(() => dismissIssueAction(issueId, text), true)}
          >
            Dismiss
          </Button>
        )}
        {isDev && !live && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => act(() => reopenIssueAction(issueId, text), true)}
          >
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
