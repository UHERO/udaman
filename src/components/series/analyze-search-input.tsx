"use client";

import { useRef, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Info, Loader2, Search } from "lucide-react";

import { searchSeriesAction } from "@/actions/series-actions";
import { SearchSyntaxHelp } from "@/components/nav-search";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SeriesSummary } from "@/core/catalog/types/udaman";

export function AnalyzeSearchInput() {
  const router = useRouter();
  const { universe } = useParams<{ universe: string }>();
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SeriesSummary[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `/udaman/${universe}/analyze`;

  function navigateToSeries(id: number) {
    router.push(`${base}?id=${id}`);
    setError(null);
    setResults([]);
    setPopoverOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch();
  }

  function doSearch() {
    const trimmed = term.trim();
    if (!trimmed) return;

    // Numeric — navigate directly by ID
    if (/^\d+$/.test(trimmed)) {
      navigateToSeries(Number(trimmed));
      return;
    }

    setError(null);
    setResults([]);
    setPopoverOpen(false);

    startTransition(async () => {
      const summaries = await searchSeriesAction(trimmed, universe);

      if (summaries.length === 0) {
        setError("No matching series found");
        return;
      }

      if (summaries.length === 1) {
        navigateToSeries(summaries[0].id);
        return;
      }

      // 2+ results — show popover to pick one
      setResults(summaries);
      setPopoverOpen(true);
    });
  }

  return (
    <div className="w-full max-w-lg">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-center rounded-sm border"
          >
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-r-none"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="w-80 text-xs">
                <SearchSyntaxHelp />
              </HoverCardContent>
            </HoverCard>

            <Input
              ref={inputRef}
              className="border-none font-mono shadow-none"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setError(null);
              }}
              placeholder="Search series by name, ID, or query..."
            />

            {isPending ? (
              <Loader2 className="text-muted-foreground mr-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="mr-0.5 shrink-0"
                disabled={!term.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </form>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="flex max-h-80 w-[var(--radix-popover-trigger-width)] flex-col p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="overflow-y-auto p-2">
            <div className="space-y-0.5">
              {results.map((s) => (
                <button
                  key={s.name}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => navigateToSeries(s.id)}
                >
                  <span className="truncate font-mono text-sm">{s.name}</span>
                  {(s.portalName || s.unitShortLabel) && (
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {s.portalName || s.unitShortLabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-destructive mt-1.5 text-sm">{error}</p>
      )}
    </div>
  );
}
