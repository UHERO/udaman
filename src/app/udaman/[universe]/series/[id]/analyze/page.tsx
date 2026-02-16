import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeSeriesAction } from "@/actions/series-actions";

import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeLayout } from "@/components/series/analyze-layout";
import { CalculateForm } from "@/components/series/calculate-form";
import { H2 } from "@/components/typography";

export default async function AnalyzeSeriesPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const numericId = Number(id);
  if (isNaN(numericId)) return notFound();

  let result;
  try {
    result = await analyzeSeriesAction(numericId);
  } catch {
    return notFound();
  }

  const { series, yoy, levelChange, ytd, stats, siblings, unitLabel, unitShortLabel } = result;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AnalyzeLayout>
        <div className="space-y-2">
          <H2>
            <Link
              href={`/udaman/${universe}/series/${id}`}
              className="hover:underline"
            >
              {series.name}
            </Link>
          </H2>
          {series.dataPortalName && (
            <p className="text-muted-foreground text-sm">
              {series.dataPortalName}
            </p>
          )}
        </div>

        <CalculateForm />

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
