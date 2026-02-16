import Link from "next/link";

import { analyzeSeriesAction } from "@/actions/series-actions";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeLayout } from "@/components/series/analyze-layout";
import { AnalyzeTabs } from "@/components/series/analyze-tabs";
import { FrequencyLinks } from "@/components/series/frequency-links";
import { RecentSeriesList } from "@/components/series/recent-series-list";
import { RecordSeriesView } from "@/components/series/record-series-view";
import { H1, H2, Lead } from "@/components/typography";

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

  // No ID — show landing with tabs + recent series
  if (!id || isNaN(id)) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <AnalyzeTabs />
          <H2>Analyze</H2>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Select a series from the series list to analyze it, or use the
              Compare and Calculate tabs above.
            </p>
          </div>
          <RecentSeriesList mode="analyze" />
        </AnalyzeLayout>
      </div>
    );
  }

  // ── Single-series analysis ───────────────────────────────────────────
  const result = await analyzeSeriesAction(id);

  const {
    series,
    yoy,
    levelChange,
    ytd,
    siblings,
    unitLabel,
    unitShortLabel,
  } = result;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {series.id && (
        <RecordSeriesView
          id={series.id}
          name={series.name}
          universe={universe}
          dataPortalName={series.dataPortalName}
        />
      )}
      <AnalyzeLayout>
        <AnalyzeTabs
          firstSeriesId={series.id}
          firstSeriesName={series.name}
          hasParams
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <H1>
              <Link
                href={`/udaman/${universe}/series/${series.id}`}
                className="hover:underline"
              >
                {series.name}
              </Link>
            </H1>
            {series.dataPortalName && (
              <Lead className="text-muted-foreground">{series.dataPortalName}</Lead>
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
          decimals={series.decimals}
          unitLabel={unitLabel}
          unitShortLabel={unitShortLabel}
          currentFreqCode={series.frequencyCode}
        />
      </AnalyzeLayout>
    </div>
  );
}
