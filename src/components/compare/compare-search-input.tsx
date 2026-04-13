"use client";

import { useRef, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Info, Loader2, Search } from "lucide-react";

import { searchSeriesAction } from "@/actions/series-actions";
import { SearchSyntaxHelp } from "@/components/nav-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface CompareSearchInputProps {
  currentNames: string[];
}

export function CompareSearchInput({ currentNames }: CompareSearchInputProps) {
  const router = useRouter();
  const { universe } = useParams<{ universe: string }>();
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SeriesSummary[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function navigateWithNames(namesToAdd: string[]) {
    const updated = [...currentNames, ...namesToAdd];
    router.push(
      `/udaman/${universe}/series/compare?names=${encodeURIComponent(updated.join(","))}`,
    );
    // Keep the term so the user can refine or re-search
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

    setError(null);
    setResults([]);
    setPopoverOpen(false);

    startTransition(async () => {
      const summaries = await searchSeriesAction(trimmed, universe);

      // Filter out series already on the chart
      const currentSet = new Set(currentNames.map((n) => n.toUpperCase()));
      const newResults = summaries.filter(
        (s) => !currentSet.has(s.name.toUpperCase()),
      );

      if (newResults.length === 0) {
        setError(
          summaries.length > 0
            ? "All matching series are already on the chart"
            : "No matching series found",
        );
        return;
      }

      if (newResults.length === 1) {
        navigateWithNames([newResults[0].name]);
        return;
      }

      // 2+ results — show multi-select popover
      setResults(newResults);
      setChecked(new Set(newResults.map((s) => s.name)));
      setPopoverOpen(true);
    });
  }

  function toggleCheck(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (checkedCount === results.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(results.map((s) => s.name)));
    }
  }

  function handleAdd() {
    const namesToAdd = results
      .filter((s) => checked.has(s.name))
      .map((s) => s.name);
    if (namesToAdd.length > 0) navigateWithNames(namesToAdd);
  }

  const checkedCount = results.filter((s) => checked.has(s.name)).length;
  const allChecked = results.length > 0 && checkedCount === results.length;

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
              placeholder="Search series to compare..."
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
          {/* Sticky top bar: select all + add button */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-popover px-2 py-2">
            <label className="flex cursor-pointer items-center gap-2 hover:opacity-80">
              <Checkbox
                checked={allChecked}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {allChecked ? "Deselect all" : "Select all"}
              </span>
            </label>
            <span className="text-xs text-muted-foreground">
              {checkedCount}/{results.length}
            </span>
            <Button
              size="sm"
              className="ml-auto h-7 px-2.5 text-xs"
              disabled={checkedCount === 0}
              onClick={handleAdd}
            >
              Add {checkedCount}
            </Button>
          </div>

          <div className="overflow-y-auto p-2">
            <div className="space-y-1">
              {results.map((s) => (
                <label
                  key={s.name}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={checked.has(s.name)}
                    onCheckedChange={() => toggleCheck(s.name)}
                  />
                  <span className="truncate font-mono text-sm">{s.name}</span>
                  {(s.portalName || s.unitShortLabel) && (
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {s.portalName || s.unitShortLabel}
                    </span>
                  )}
                </label>
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
