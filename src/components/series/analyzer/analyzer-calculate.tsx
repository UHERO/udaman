"use client";

import { useState, useTransition } from "react";
import { Calculator, CornerDownLeft, Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";

interface AnalyzerCalculateProps {
  /** Evaluates the expression; resolves true when it was added to the chart. */
  onSubmit: (expression: string) => Promise<boolean>;
}

export function AnalyzerCalculate({ onSubmit }: AnalyzerCalculateProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const added = await onSubmit(trimmed);
      // Keep the text on failure so the expression can be corrected in place.
      if (added) setValue("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg items-center overflow-hidden rounded-sm border"
    >
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-1.5 self-stretch rounded-none px-3"
          >
            <Calculator className="h-4 w-4" />
            Calculate
            <Info className="text-muted-foreground h-3 w-3" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-80 space-y-2 text-xs">
          <p>
            Combine series with <code>+ - * / **</code> and parentheses. The
            result is added to the chart as its own series.
          </p>
          <ul className="text-muted-foreground space-y-1">
            <li>
              <code>VIS@HI.Q / CPI@US.Q</code>
            </li>
            <li>
              <code>(VIS@HI.Q / CPI@US.Q) * 100</code>
            </li>
            <li>
              <code>E_NF@HI.M.yoy</code>
            </li>
          </ul>
          <p className="text-muted-foreground">
            Once added, edit the expression inline in the series list.
          </p>
        </HoverCardContent>
      </HoverCard>

      <Input
        className="border-none font-mono shadow-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="VIS@HI.Q / CPI@US.Q"
        disabled={isPending}
      />

      {isPending ? (
        <Loader2 className="text-muted-foreground mr-2 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="mr-0.5 shrink-0"
          disabled={!value.trim()}
        >
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
