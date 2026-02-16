import {
  compareSeriesAction,
  getCompareAllGeosAction,
  getCompareSANSAction,
} from "@/actions/series-actions";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeLayout } from "@/components/series/analyze-layout";
import { AnalyzeTabs } from "@/components/series/analyze-tabs";
import { CompareAddInput } from "@/components/series/compare-add-input";
import { CompareSeriesBadges } from "@/components/series/compare-series-badges";
import { CompareSuggestions } from "@/components/series/compare-suggestions";
import { RecentSeriesList } from "@/components/series/recent-series-list";
import { H2 } from "@/components/typography";

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

  // Landing state — no names at all
  if (names.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <AnalyzeTabs />
          <H2>Compare</H2>
          <CompareAddInput currentNames={names} />
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Enter two or more series names to compare them side by side.
              For example:
            </p>
            <ul className="list-inside list-disc space-y-1 font-mono text-xs">
              <li>E_NF@HI.M, E_NF@MAU.M</li>
              <li>VISRESNS@NBI.M, VISRESNS@HAW.M</li>
            </ul>
          </div>
          <RecentSeriesList mode="compare" currentNames={names} />
        </AnalyzeLayout>
      </div>
    );
  }

  // ── Load series (works with 1 or more names) ─────────────────────────
  const result = await compareSeriesAction(names);

  if ("error" in result) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <AnalyzeTabs firstSeriesName={names[0]} hasParams />
          <H2>Compare</H2>
          <CompareAddInput currentNames={names} />
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Error loading series
            </p>
            <p className="mt-1 font-mono text-xs text-red-600">
              {result.error}
            </p>
          </div>
        </AnalyzeLayout>
      </div>
    );
  }

  const { series, seriesLinks } = result;
  const firstDecimals = series[0]?.decimals ?? 1;
  const suggestionName = names[0];

  const [allGeosNames, saNsNames] = await Promise.all([
    getCompareAllGeosAction(suggestionName, universe),
    getCompareSANSAction(suggestionName),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AnalyzeLayout>
        <AnalyzeTabs
          firstSeriesId={seriesLinks[names[0]] ?? null}
          firstSeriesName={names[0]}
          hasParams
        />
        <H2>Compare</H2>

        <div className="flex items-center gap-2">
          <CompareAddInput currentNames={names} />
          <CompareSuggestions
            allGeosNames={allGeosNames}
            saNsNames={saNsNames}
            universe={universe}
          />
        </div>

        {seriesLinks && Object.keys(seriesLinks).length > 0 && (
          <CompareSeriesBadges
            names={names}
            seriesLinks={seriesLinks}
            universe={universe}
          />
        )}

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
        />
      </AnalyzeLayout>
    </div>
  );
}
