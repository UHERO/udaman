"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  getFilterOptionsAction,
  getMeasurementOptionsAction,
  getPrefixOptionsAction,
  resolveCompareFiltersAction,
} from "@/actions/compare-filters";
import { Button } from "@/components/ui/button";

import { FilterRowControls } from "./filter-row-controls";
import {
  ALL_FREQUENCY_OPTIONS,
  buildRowsFromNames,
  makeEmptyRow,
  type BuilderHandle,
  type FilterRowState,
  type GeoFreqOptions,
  type MeasurementOptionsCache,
  type OptionsCache,
  type PrefixOptionsCache,
} from "./parse-filter-names";
import { UnifiedPrefixCombobox } from "./unified-prefix-combobox";

interface CompareFilterBuilderProps {
  initialMeasurements: {
    id: number;
    prefix: string;
    dataPortalName: string | null;
  }[];
  initialGeos: { handle: string; displayName: string | null }[];
  currentUniverse: string;
  currentFrequency: string;
  currentNames: string[];
  onFilledCountChange?: (count: number) => void;
}

export const CompareFilterBuilder = forwardRef<
  BuilderHandle,
  CompareFilterBuilderProps
>(function CompareFilterBuilder(
  {
    initialMeasurements,
    initialGeos,
    currentUniverse,
    currentFrequency,
    currentNames,
    onFilledCountChange,
  },
  ref,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const universe = currentUniverse.toUpperCase();

  const [rows, setRows] = useState<FilterRowState[]>(() =>
    currentNames.length > 0
      ? buildRowsFromNames(currentNames, universe, currentFrequency || "Q")
      : [makeEmptyRow(universe, currentFrequency || "Q")],
  );

  const [optionsCache, setOptionsCache] = useState<OptionsCache>(() => ({
    [universe]: {
      measurements: initialMeasurements,
      geos: initialGeos,
    },
  }));

  const [measurementOptionsCache, setMeasurementOptionsCache] =
    useState<MeasurementOptionsCache>({});

  const [prefixOptionsCache, setPrefixOptionsCache] =
    useState<PrefixOptionsCache>({});

  const getOptions = useCallback(
    (u: string) => optionsCache[u],
    [optionsCache],
  );

  const fetchOptionsForUniverse = useCallback(
    async (u: string) => {
      if (optionsCache[u]) return;
      const options = await getFilterOptionsAction(u);
      setOptionsCache((prev) => ({ ...prev, [u]: options }));
    },
    [optionsCache],
  );

  const fetchMeasurementOptions = useCallback(
    async (measurementId: number) => {
      if (measurementOptionsCache[measurementId]) return;
      const opts = await getMeasurementOptionsAction(measurementId);
      setMeasurementOptionsCache((prev) => ({
        ...prev,
        [measurementId]: opts,
      }));
    },
    [measurementOptionsCache],
  );

  const fetchPrefixOptions = useCallback(
    async (prefix: string, uni: string) => {
      const key = `${prefix}|${uni}`;
      if (prefixOptionsCache[key]) return;
      const options = await getPrefixOptionsAction(prefix, uni);
      setPrefixOptionsCache((prev) => ({ ...prev, [key]: options }));
    },
    [prefixOptionsCache],
  );

  const updateRow = useCallback(
    (id: string, updates: Partial<FilterRowState>) => {
      setError(null);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );
    },
    [],
  );

  const removeRow = useCallback(
    (id: string) => {
      setError(null);
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        return next.length === 0
          ? [makeEmptyRow(universe, currentFrequency || "Q")]
          : next;
      });
    },
    [universe, currentFrequency],
  );

  const addRow = useCallback(() => {
    setError(null);
    setRows((prev) => [
      ...prev,
      makeEmptyRow(universe, currentFrequency || "Q"),
    ]);
  }, [universe, currentFrequency]);

  // Report filled count to parent
  const filledCount = rows.filter((r) => r.prefix.trim()).length;
  const onFilledCountChangeRef = useRef(onFilledCountChange);
  useEffect(() => {
    onFilledCountChangeRef.current = onFilledCountChange;
  });
  useEffect(() => {
    onFilledCountChangeRef.current?.(filledCount);
  }, [filledCount]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), 15000),
    );
    const result = await Promise.race([
      resolveCompareFiltersAction(rows),
      timeout,
    ]);
    if (result.names.length === 0) {
      setError("No matching series found");
      throw new Error("No matching series found");
    }
    const expr = result.names.join(",");
    const url = new URL(window.location.href);
    url.searchParams.set("names", expr);
    router.push(url.pathname + url.search);
  }, [rows, router]);

  useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

  /** Get cross-filtering options for a row based on its mode. */
  const getRowGeoFreqOptions = (row: FilterRowState): GeoFreqOptions | null => {
    if (row.mode === "measurement" && row.measurementId) {
      return measurementOptionsCache[row.measurementId] ?? null;
    }
    if (row.prefix) {
      return prefixOptionsCache[`${row.prefix}|${row.universe}`] ?? null;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {rows.map((row) => {
          const options = getOptions(row.universe);
          const allGeos = options?.geos ?? [];
          const rowOpts = getRowGeoFreqOptions(row);

          let filteredGeos = allGeos;
          let freqOptions = ALL_FREQUENCY_OPTIONS;

          if (rowOpts) {
            // Cross-filter frequencies
            let availableFreqs = rowOpts.frequencies;
            if (row.geos.length > 0) {
              const geoSet = new Set(row.geos.map((g) => g.toUpperCase()));
              const freqsForGeos = new Set(
                rowOpts.combinations
                  .filter((c) => geoSet.has(c.geo))
                  .map((c) => c.freq),
              );
              availableFreqs = availableFreqs.filter((f) =>
                freqsForGeos.has(f),
              );
            }
            freqOptions = ALL_FREQUENCY_OPTIONS.filter((f) =>
              availableFreqs.includes(f.value),
            );

            // Cross-filter geos
            let availableGeoHandles = rowOpts.geos;
            if (row.frequency) {
              const geosWithFreq = new Set(
                rowOpts.combinations
                  .filter((c) => c.freq === row.frequency)
                  .map((c) => c.geo),
              );
              availableGeoHandles = availableGeoHandles.filter((g) =>
                geosWithFreq.has(g),
              );
            }
            const geoSet = new Set(availableGeoHandles);
            filteredGeos = allGeos.filter((g) => geoSet.has(g.handle));
          }

          return (
            <div
              key={row.id}
              className={`flex items-center gap-2 rounded-md p-1 -m-1 ${
                error ? "bg-red-50 ring-1 ring-red-200" : ""
              }`}
            >
              <UnifiedPrefixCombobox
                measurements={options?.measurements ?? []}
                value={row.prefix}
                measurementId={row.measurementId}
                universe={row.universe}
                onSelect={(prefix, mode, mId) => {
                  updateRow(row.id, {
                    prefix,
                    mode,
                    measurementId: mId,
                  });
                  if (mode === "measurement" && mId) {
                    fetchMeasurementOptions(mId);
                  } else if (prefix) {
                    fetchPrefixOptions(prefix, row.universe);
                  }
                }}
              />
              <FilterRowControls
                row={row}
                geos={filteredGeos}
                freqOptions={freqOptions}
                onUpdate={(updates) => updateRow(row.id, updates)}
                onRemove={() => removeRow(row.id)}
                onUniverseChange={(u) => {
                  fetchOptionsForUniverse(u);
                  if (row.mode === "measurement" && row.measurementId) {
                    // Measurement options are ID-based, no re-fetch needed
                  } else if (row.prefix) {
                    fetchPrefixOptions(row.prefix, u);
                  }
                }}
                error={!!error}
              />
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={addRow}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Row
      </Button>
    </div>
  );
});
