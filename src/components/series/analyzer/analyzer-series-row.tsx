"use client";

import { useRef, useState } from "react";
import { ArrowRightLeft, Eye, EyeOff, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AnalyzerEntry } from "./types";

interface AnalyzerSeriesRowProps {
  entry: AnalyzerEntry;
  color: string;
  isStatsSelected?: boolean;
  onSelectStats?: (id: string) => void;
  onExpressionChange: (id: string, expression: string) => void;
  onVisibilityChange: (id: string, visibility: AnalyzerEntry["visibility"]) => void;
  onAxisChange: (id: string, axis: "left" | "right") => void;
  onRemove: (id: string) => void;
}

/** Convert expression to a user-friendly display string.
 *  `"VIS@HAW.Q".ts` → `VIS@HAW.Q`; complex expressions shown as-is */
function exprToEditable(expr: string): string {
  const m = expr.match(/^"([^"]+)"\.tsn?$/);
  return m ? m[1] : expr;
}

/** Wrap a plain series name back into eval syntax.
 *  If the input already looks like an expression (contains quotes, dots-after-quotes,
 *  operators, etc.) it's returned as-is. */
function editableToExpr(input: string): string {
  // Already looks like an expression (has quotes or .ts/.tsn suffix)
  if (input.includes('"')) return input;
  // Plain series name like VIS@HAW.Q → "VIS@HAW.Q".ts
  return `"${input}".ts`;
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

  const opacity =
    entry.visibility === "hidden" ? 0.35 : entry.visibility === "gray" ? 0.55 : 1;

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
        className="h-7 flex-1 border-transparent font-mono text-xs shadow-none focus:border-input"
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

      {/* Error indicator */}
      {entry.error && !entry.loading && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default shrink-0 text-xs text-red-500">
              ✕
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{entry.error}</TooltipContent>
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
              onAxisChange(
                entry.id,
                entry.axis === "left" ? "right" : "left",
              )
            }
          >
            <ArrowRightLeft className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Move to {entry.axis === "left" ? "right" : "left"} axis
        </TooltipContent>
      </Tooltip>

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
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
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
