import type { Universe } from "@catalog/types/shared";

import { getFormOptions, getSeriesById } from "@/actions/series-actions";
import { SeriesDuplicateForm } from "@/components/series/series-duplicate-form";

export default async function DuplicateSeriesPage({
  params,
}: {
  params: Promise<{ universe: string; id: number }>;
}) {
  const { universe, id } = await params;
  const u = universe as Universe;

  const [series, formOptions] = await Promise.all([
    getSeriesById(id, { universe: u }),
    getFormOptions({ universe: u }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SeriesDuplicateForm
        universe={universe}
        sourceSeriesId={id}
        metadata={series.metadata}
        loaderCount={series.loaders.filter((l) => !l.disabled).length}
        geographies={formOptions.geographies}
        units={formOptions.units}
        sources={formOptions.sources}
        sourceDetails={formOptions.sourceDetails}
      />
    </div>
  );
}
