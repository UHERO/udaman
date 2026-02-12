import { getFormOptions } from "@/actions/series-actions";
import { SeriesCreateForm } from "@/components/series/series-create-form";
import type { Universe } from "@catalog/types/shared";

export default async function CreateSeriesPage({
  params,
}: {
  params: Promise<{ universe: Universe }>;
}) {
  const { universe } = await params;

  const { geographies, units, sources, sourceDetails } = await getFormOptions({
    universe,
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SeriesCreateForm
        universe={universe}
        geographies={geographies}
        units={units}
        sources={sources}
        sourceDetails={sourceDetails}
      />
    </div>
  );
}
