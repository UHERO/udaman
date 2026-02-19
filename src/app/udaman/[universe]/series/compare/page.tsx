import { getFilterOptionsAction } from "@/actions/compare-filters";
import { compareSeriesAction } from "@/actions/series-actions";
import { CompareToolbar } from "@/components/compare/compare-toolbar";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { RecentSeriesList } from "@/components/series/recent-series-list";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe } = await params;
  const { names: namesParam } = await searchParams;
  const namesStr = typeof namesParam === "string" ? namesParam : undefined;
  const names = namesStr
    ? namesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const filterOptions = await getFilterOptionsAction(universe);

  // Landing state — no names at all
  if (names.length === 0) {
    return (
      <>
        <div>
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-muted-foreground text-sm">
            Compare two or more series side by side.
          </p>
        </div>
        <CompareToolbar
          initialMeasurements={filterOptions.measurements}
          initialGeos={filterOptions.geos}
          currentUniverse={universe}
          currentFrequency="Q"
          currentNames={names}
        />
        <RecentSeriesList mode="compare" currentNames={names} />
      </>
    );
  }

  // ── Load series (works with 1 or more names) ─────────────────────────
  const result = await compareSeriesAction(names);

  if ("error" in result) {
    return (
      <>
        <div>
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-muted-foreground text-sm">
            Compare two or more series side by side.
          </p>
        </div>
        <CompareToolbar
          initialMeasurements={filterOptions.measurements}
          initialGeos={filterOptions.geos}
          currentUniverse={universe}
          currentFrequency="Q"
          currentNames={names}
        />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Error loading series
          </p>
          <p className="mt-1 font-mono text-xs text-red-600">
            {result.error}
          </p>
        </div>
      </>
    );
  }

  const { series, seriesLinks } = result;
  const firstDecimals = series[0]?.decimals ?? 1;

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="text-muted-foreground text-sm">
          Compare two or more series side by side.
        </p>
      </div>

      <CompareToolbar
        initialMeasurements={filterOptions.measurements}
        initialGeos={filterOptions.geos}
        currentUniverse={universe}
        currentFrequency={series[0]?.frequencyCode ?? "Q"}
        currentNames={names}
      />

      {/* With only 1 series, show recent series as pills to quickly add more */}
      {names.length === 1 && (
        <RecentSeriesList mode="compare" currentNames={names} compact />
      )}

      <AnalyzeControls
        data={[]}
        yoy={[]}
        ytd={[]}
        levelChange={[]}
        decimals={firstDecimals}
        compareSeries={series.map((s) => ({
          name: s.name,
          data: s.data,
          unitShortLabel: s.unitShortLabel,
        }))}
        currentFreqCode={series[0]?.frequencyCode}
        seriesLinks={seriesLinks}
        universe={universe}
      />
    </>
  );
}
