"use client";

import { useRef, useState } from "react";
import {
  ArrowRightLeft,
  ChartColumn,
  Eye,
  EyeOff,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { editableToExpr, exprToEditable } from "./expr-utils";
import type { AnalyzerEntry } from "./types";

interface AnalyzerSeriesRowProps {
  entry: AnalyzerEntry;
  color: string;
  isStatsSelected?: boolean;
  onSelectStats?: (id: string) => void;
  onExpressionChange: (id: string, expression: string) => void;
  onVisibilityChange: (
    id: string,
    visibility: AnalyzerEntry["visibility"],
  ) => void;
  onAxisChange: (id: string, axis: "left" | "right") => void;
  onRemove: (id: string) => void;
  onCompareYoY?: (id: string) => void;
}

export function AnalyzerSeriesRow({
  entry,
  color,
  isStatsSelected,
  onSelectStats,
  onExpressionChange,
  onVisibilityChange,
  onAxisChange,
  onRemove,
  onCompareYoY,
}: AnalyzerSeriesRowProps) {
  const [draft, setDraft] = useState(() => exprToEditable(entry.expression));
  const inputRef = useRef<HTMLInputElement>(null);
  const justCommitted = useRef(false);

  // Keep draft in sync when expression changes externally (e.g. on init)
  const lastExpression = useRef(entry.expression);
  if (entry.expression !== lastExpression.current) {
    lastExpression.current = entry.expression;
    setDraft(exprToEditable(entry.expression));
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const expr = editableToExpr(trimmed);
    if (expr !== entry.expression) {
      onExpressionChange(entry.id, expr);
    }
  }

  // A failed evaluation leaves the last good data on the chart, so the input
  // text and what's plotted disagree until the expression is fixed.
  const isStale = Boolean(entry.error) && !entry.loading;

  const opacity =
    entry.visibility === "hidden"
      ? 0.35
      : entry.visibility === "gray"
        ? 0.55
        : 1;

  const nextVisibility: AnalyzerEntry["visibility"] =
    entry.visibility === "active"
      ? "gray"
      : entry.visibility === "gray"
        ? "hidden"
        : "active";

  const visTooltip =
    entry.visibility === "active"
      ? "Gray out"
      : entry.visibility === "gray"
        ? "Hide"
        : "Show";

  return (
    <div
      className="group flex items-center gap-0.5 rounded px-1 py-0.5"
      style={{ opacity }}
    >
      {/* Color indicator */}
      <span
        className="inline-block h-5 w-1.5 shrink-0 rounded-sm"
        style={{
          backgroundColor:
            entry.visibility === "hidden" ? "transparent" : color,
          border:
            entry.visibility === "hidden"
              ? `1.5px solid ${color}`
              : "1.5px solid transparent",
        }}
      />

      {/* Expression input */}
      <Input
        ref={inputRef}
        className={`focus:border-input h-7 flex-1 font-mono text-xs shadow-none ${
          isStale
            ? "border-amber-500/70 bg-amber-50 dark:bg-amber-950/20"
            : "border-transparent"
        }`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!justCommitted.current) commit();
          justCommitted.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            justCommitted.current = true;
            commit();
            inputRef.current?.blur();
          }
        }}
      />

      {/* Loading indicator */}
      {entry.loading && (
        <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
      )}

      {/* Error indicator — chart still shows the last valid result */}
      {isStale && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 cursor-default text-xs text-amber-600 dark:text-amber-500">
              ✕
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>{entry.error}</p>
            {entry.data.length > 0 && (
              <p className="mt-1 opacity-80">
                Showing the last result that evaluated ({entry.name}).
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Inline action icons */}
      {onSelectStats && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              <Checkbox
                checked={isStatsSelected}
                onCheckedChange={() => onSelectStats(entry.id)}
                className="h-3.5 w-3.5"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">Show stats</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() =>
              onAxisChange(entry.id, entry.axis === "left" ? "right" : "left")
            }
          >
            <ArrowRightLeft className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Move to {entry.axis === "left" ? "right" : "left"} axis
        </TooltipContent>
      </Tooltip>

      {onCompareYoY && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onCompareYoY(entry.id)}
            >
              <ChartColumn className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Compare YoY</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onVisibilityChange(entry.id, nextVisibility)}
          >
            {entry.visibility === "hidden" ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{visTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0"
            onClick={() => onRemove(entry.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Remove</TooltipContent>
      </Tooltip>
    </div>
  );
}
