"use client";

import { useRef, useState } from "react";
import { Check, Code, Link as LinkIcon, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { absolutePortalUrl } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { embedParams, embedSnippet, shareParams } from "./share-urls";
import type { ShareTarget } from "./share-urls";

export type { ShareTarget } from "./share-urls";

/**
 * "Share" button + dialog with a copyable portal link and an iframe embed
 * snippet for the /graph route (Angular share-link).
 *
 *   <ShareLink view="series" seriesId={id} seasonallyAdjusted={sa}
 *              start={params.start} end={params.end} />
 *   <ShareLink view="analyzer" analyzerParams={analyzerParams} />
 *
 * start/end should be the ROUTE values (null for the default range / end of
 * sample, see rangeToParams) so shared links keep "latest data" semantics.
 * URLs are computed when the dialog opens, so they reflect shallow
 * (history.replaceState) range changes too.
 */
export function ShareLink(props: ShareTarget & { className?: string }) {
  const { className, ...target } = props;
  const { config } = usePortalConfig();
  const [open, setOpen] = useState(false);

  let shareUrl = "";
  let embedCode = "";
  if (open) {
    const route = target.view === "series" ? "series" : "analyzer";
    shareUrl = absolutePortalUrl(
      config.universe,
      config.exportLabels.publicUrl,
      route,
      shareParams(target),
    );
    embedCode = embedSnippet(
      absolutePortalUrl(
        config.universe,
        config.exportLabels.publicUrl,
        "graph",
        embedParams(target),
      ),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-7 rounded-none px-2.5 text-xs", className)}
        >
          <Share2 className="size-3.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Share or Embed</DialogTitle>
          <DialogDescription className="text-xs">
            Link to this view, or paste the embed code into a web page to show
            the chart.
          </DialogDescription>
        </DialogHeader>
        <CopyField label="Share" icon={LinkIcon} value={shareUrl} />
        <CopyField label="Embed" icon={Code} value={embedCode} />
      </DialogContent>
    </Dialog>
  );
}

function CopyField({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const id = `share-${label.toLowerCase()}`;

  async function copy() {
    const el = inputRef.current;
    el?.select();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for browsers without clipboard permission (Angular did the same).
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
      >
        {label}
      </label>
      <div className="flex">
        <input
          id={id}
          ref={inputRef}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="border-input focus-visible:border-ring h-8 min-w-0 flex-1 border border-r-0 bg-transparent px-2 font-mono text-xs outline-none"
        />
        <Button
          type="button"
          variant="outline"
          onClick={copy}
          className="h-8 w-24 shrink-0 rounded-none text-xs shadow-none"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
