import Link from "next/link";

import { analyzeSeriesAction } from "@/actions/series-actions";
import { listTimelineEventsAction } from "@/actions/timeline-events";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeSearchInput } from "@/components/series/analyze-search-input";
import { FrequencyLinks } from "@/components/series/frequency-links";
import { RecentSeriesList } from "@/components/series/recent-series-list";
import { RecordSeriesView } from "@/components/series/record-series-view";

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe } = await params;
  const { id: idParam } = await searchParams;
  const id = typeof idParam === "string" ? Number(idParam) : NaN;

  // No ID — show landing with recent series
  if (!id || isNaN(id)) {
    return (
      <>
        <div>
          <h1 className="text-3xl font-bold">Analyze</h1>
          <p className="text-muted-foreground text-sm">
            Select a series from the list to analyze, or use the Compare and
            Calculate tabs.
          </p>
        </div>
        <AnalyzeSearchInput />
        <RecentSeriesList mode="analyze" />
      </>
    );
  }

  // ── Single-series analysis ───────────────────────────────────────────
  const [result, rawEvents] = await Promise.all([
    analyzeSeriesAction(id),
    listTimelineEventsAction(),
  ]);
  const timelineEvents = rawEvents.map((e) => ({
    id: e.id,
    start: e.startDate,
    end: e.effectiveEndDate,
    name: e.name,
    eventType: e.eventType,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
  }));

  const { series, yoy, levelChange, ytd, pop, siblings, unitLabel, unitShortLabel } =
    result;

  return (
    <>
      {series.id && (
        <RecordSeriesView
          id={series.id}
          name={series.name}
          universe={universe}
          dataPortalName={series.dataPortalName}
        />
      )}

      <div className="flex items-center gap-3">
        <AnalyzeSearchInput />
        <Link
          href={`/udaman/${universe}/series/analyze`}
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-medium"
        >
          Reset
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            <Link
              href={`/udaman/${universe}/series/${series.id}`}
              className="hover:underline"
            >
              {series.name}
            </Link>
          </h1>
          {series.dataPortalName && (
            <p className="text-muted-foreground text-sm">
              {series.dataPortalName}
            </p>
          )}
        </div>
        {siblings && (
          <FrequencyLinks
            universe={universe}
            currentFreqCode={series.frequencyCode}
            siblings={siblings}
          />
        )}
      </div>

      <AnalyzeControls
        data={series.data}
        yoy={yoy}
        ytd={ytd}
        levelChange={levelChange}
        pop={pop}
        decimals={series.decimals}
        unitLabel={unitLabel}
        unitShortLabel={unitShortLabel}
        currentFreqCode={series.frequencyCode}
        timelineEvents={timelineEvents}
      />
    </>
  );
}
