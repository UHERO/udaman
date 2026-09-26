"use client";

import { useRef, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Copy to Clipboard" companion to the Download CSV buttons. `getText` runs
 * on click so large tables are only serialized when asked for.
 */
export function CopyButton({
  getText,
  label = "Copy to Clipboard",
  className,
}: {
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  async function copy() {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard permission (e.g. insecure origin): hidden-textarea fallback.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      aria-live="polite"
      className={cn("h-7 rounded-none text-xs", className)}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <ClipboardCopy className="size-3.5" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
