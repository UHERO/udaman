"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { transformSeriesAction } from "@/actions/series-actions";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import type { TimelineEventForChart } from "@/components/series/analyze-chart";

import { AnalyzerSearch } from "./analyzer-search";
import type { AnalyzerEntry } from "./types";

interface AnalyzerProps {
  initialNames?: string[];
  initialExprs?: string[];
  initialVis?: string;
  initialAxes?: string;
  universe: string;
  timelineEvents: TimelineEventForChart[];
}

/** Convert a bare series name to an eval expression */
function nameToExpr(name: string): string {
  return `"${name}".ts`;
}

/** Extract a display name from an expression, e.g. '"E_NF@HI.M".ts' → 'E_NF@HI.M' */
function exprToDisplayName(expr: string): string {
  // Simple series reference: "NAME".ts → NAME
  const simpleMatch = expr.match(/^"([^"]+)"\.tsn?$/);
  if (simpleMatch) return simpleMatch[1];

  // Modified expression: extract first quoted series name → NAME (modified)
  const firstQuoted = expr.match(/"([^"]+)"/);
  if (firstQuoted) return `${firstQuoted[1]} (modified)`;

  return expr;
}

export function Analyzer({
  initialNames,
  initialExprs,
  initialVis,
  initialAxes,
  universe,
  timelineEvents,
}: AnalyzerProps) {
  const [entries, setEntries] = useState<AnalyzerEntry[]>(() => {
    const list: AnalyzerEntry[] = [];

    // Parse initial visibility
    const visMap = new Map<number, "active" | "gray" | "hidden">();
    if (initialVis) {
      for (const part of initialVis.split(",")) {
        const [idx, state] = part.split(":");
        if (state === "gray" || state === "hidden")
          visMap.set(Number(idx), state);
      }
    }

    // Parse initial axes
    const axesMap = new Map<number, "left" | "right">();
    if (initialAxes) {
      for (const part of initialAxes.split(",")) {
        const [idx, side] = part.split(":");
        if (side === "left" || side === "right")
          axesMap.set(Number(idx), side);
      }
    }

    if (initialExprs && initialExprs.length > 0) {
      for (let i = 0; i < initialExprs.length; i++) {
        const expr = initialExprs[i];
        list.push({
          id: crypto.randomUUID(),
          expression: expr,
          name: exprToDisplayName(expr),
          data: [],
          unitShortLabel: null,
          decimals: 1,
          frequencyCode: null,
          visibility: visMap.get(i) ?? "active",
          axis: axesMap.get(i) ?? "left",
          loading: true,
          error: null,
        });
      }
    } else if (initialNames && initialNames.length > 0) {
      for (let i = 0; i < initialNames.length; i++) {
        list.push({
          id: crypto.randomUUID(),
          expression: nameToExpr(initialNames[i]),
          name: initialNames[i],
          data: [],
          unitShortLabel: null,
          decimals: 1,
          frequencyCode: null,
          visibility: visMap.get(i) ?? "active",
          axis: axesMap.get(i) ?? "left",
          loading: true,
          error: null,
        });
      }
    }

    return list;
  });

  // Track whether initial load has happened
  const didInitialLoad = useRef(false);

  // Track in-flight evaluation version per entry to discard stale results
  const evalVersions = useRef(new Map<string, number>());

  // ── Evaluate a single entry ──────────────────────────────────────────
  const evaluateEntry = useCallback(async (id: string, expression: string) => {
    const version = (evalVersions.current.get(id) ?? 0) + 1;
    evalVersions.current.set(id, version);

    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, loading: true, error: null } : e,
      ),
    );

    const result = await transformSeriesAction(expression);

    // Discard result if a newer evaluation has been started
    if (evalVersions.current.get(id) !== version) return;

    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if ("error" in result) {
          return { ...e, loading: false, error: result.error };
        }
        return {
          ...e,
          name: exprToDisplayName(expression),
          data: result.series.data,
          unitShortLabel: result.unitShortLabel ?? null,
          decimals: result.series.decimals,
          frequencyCode: result.series.frequencyCode ?? null,
          loading: false,
          error: null,
        };
      }),
    );
  }, []);

  // ── Initial evaluation of all entries ────────────────────────────────
  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;

    for (const entry of entries) {
      evaluateEntry(entry.id, entry.expression);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    (names: string[]) => {
      const newEntries: AnalyzerEntry[] = names.map((name) => ({
        id: crypto.randomUUID(),
        expression: nameToExpr(name),
        name,
        data: [],
        unitShortLabel: null,
        decimals: 1,
        frequencyCode: null,
        visibility: "active" as const,
        axis: "left" as const,
        loading: true,
        error: null,
      }));

      setEntries((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        evaluateEntry(entry.id, entry.expression);
      }
    },
    [evaluateEntry],
  );

  const handleExpressionChange = useCallback(
    (id: string, expression: string) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, expression, name: exprToDisplayName(expression) }
            : e,
        ),
      );
      evaluateEntry(id, expression);
    },
    [evaluateEntry],
  );

  const handleVisibilityChange = useCallback(
    (id: string, visibility: AnalyzerEntry["visibility"]) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, visibility } : e)),
      );
    },
    [],
  );

  const handleAxisChange = useCallback(
    (id: string, axis: "left" | "right") => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, axis } : e)),
      );
    },
    [],
  );

  const handleRemove = useCallback((id: string) => {
    evalVersions.current.delete(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAddCompareYoY = useCallback(
    (id: string) => {
      const source = entries.find((e) => e.id === id);
      if (!source) return;

      const newEntry: AnalyzerEntry = {
        id: crypto.randomUUID(),
        expression: source.expression,
        name: source.name,
        data: [],
        unitShortLabel: null,
        decimals: 1,
        frequencyCode: null,
        visibility: "gray",
        axis: "right",
        loading: true,
        error: null,
      };

      setEntries((prev) => [...prev, newEntry]);
      evaluateEntry(newEntry.id, newEntry.expression);
    },
    [entries, evaluateEntry],
  );

  // ── Derive state for AnalyzeControls ─────────────────────────────────
  const compareSeries = useMemo(() => {
    const loaded = entries.filter((e) => e.data.length > 0);
    // Deduplicate names to prevent chart key collisions
    const seen = new Map<string, number>();
    return loaded.map((e) => {
      const count = seen.get(e.name) ?? 0;
      seen.set(e.name, count + 1);
      return {
        name: count > 0 ? `${e.name} (${count + 1})` : e.name,
        data: e.data,
        unitShortLabel: e.unitShortLabel,
      };
    });
  }, [entries]);

  // Map from entry-list index (which includes entries without data) to
  // compareSeries index (only entries with data).  Both visibility and axes
  // controlled maps need this translation.
  const entryToCompareIndex = useMemo(() => {
    const map = new Map<number, number>();
    let ci = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].data.length > 0) {
        map.set(i, ci);
        ci++;
      }
    }
    return map;
  }, [entries]);

  const controlledVisibility = useMemo(() => {
    const map = new Map<number, "gray" | "hidden">();
    for (let i = 0; i < entries.length; i++) {
      const ci = entryToCompareIndex.get(i);
      if (ci == null) continue;
      const vis = entries[i].visibility;
      if (vis === "gray" || vis === "hidden") map.set(ci, vis);
    }
    return map;
  }, [entries, entryToCompareIndex]);

  const controlledAxes = useMemo(() => {
    const map = new Map<number, "left" | "right">();
    for (let i = 0; i < entries.length; i++) {
      const ci = entryToCompareIndex.get(i);
      if (ci == null) continue;
      map.set(ci, entries[i].axis);
    }
    return map;
  }, [entries, entryToCompareIndex]);

  const currentNames = useMemo(
    () => entries.map((e) => e.name),
    [entries],
  );

  const firstFreqCode = entries.find((e) => e.frequencyCode)?.frequencyCode;

  // ── Stats selection ─────────────────────────────────────────────────
  const [selectedStatsId, setSelectedStatsId] = useState<string | null>(null);

  // Default to the first loaded entry if none selected (or selection removed)
  const effectiveStatsId = useMemo(() => {
    const loadedEntries = entries.filter((e) => e.data.length > 0);
    if (loadedEntries.length === 0) return null;
    if (selectedStatsId && loadedEntries.some((e) => e.id === selectedStatsId)) {
      return selectedStatsId;
    }
    return loadedEntries[0].id;
  }, [entries, selectedStatsId]);

  // Derive the compare-series index for the selected stats entry
  const selectedStatsCompareIndex = useMemo(() => {
    if (!effectiveStatsId) return 0;
    const entryIdx = entries.findIndex((e) => e.id === effectiveStatsId);
    if (entryIdx < 0) return 0;
    return entryToCompareIndex.get(entryIdx) ?? 0;
  }, [effectiveStatsId, entries, entryToCompareIndex]);

  // ── URL sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);

    // Remove legacy names param
    url.searchParams.delete("names");

    // Write exprs
    if (entries.length > 0) {
      url.searchParams.set(
        "exprs",
        entries.map((e) => e.expression).join("|"),
      );
    } else {
      url.searchParams.delete("exprs");
    }

    // Write vis
    const visParts: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].visibility !== "active") {
        visParts.push(`${i}:${entries[i].visibility}`);
      }
    }
    if (visParts.length > 0) {
      url.searchParams.set("vis", visParts.join(","));
    } else {
      url.searchParams.delete("vis");
    }

    // Write axes
    const axesParts: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].axis !== "left") {
        axesParts.push(`${i}:${entries[i].axis}`);
      }
    }
    if (axesParts.length > 0) {
      url.searchParams.set("axes", axesParts.join(","));
    } else {
      url.searchParams.delete("axes");
    }

    // Replace without navigation
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [entries]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">Analyze</h1>
        <p className="text-muted-foreground text-sm">
          Add series to analyze side by side. Edit expressions for custom
          calculations.
        </p>
      </div>

      <AnalyzerSearch currentNames={currentNames} onAdd={handleAdd} />

      {compareSeries.length > 0 && (
        <AnalyzeControls
          decimals={entries[0]?.decimals ?? 1}
          compareSeries={compareSeries}
          currentFreqCode={firstFreqCode}
          universe={universe}
          timelineEvents={timelineEvents}
          controlledVisibility={controlledVisibility}
          controlledAxes={controlledAxes}
          selectedStatsSeriesIndex={selectedStatsCompareIndex}
          entries={entries}
          selectedStatsId={effectiveStatsId}
          onSelectStats={setSelectedStatsId}
          onExpressionChange={handleExpressionChange}
          onVisibilityChange={handleVisibilityChange}
          onAxisChange={handleAxisChange}
          onRemove={handleRemove}
          onAddCompareYoY={handleAddCompareYoY}
        />
      )}
    </div>
  );
}
