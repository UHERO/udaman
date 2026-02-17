import type { Universe } from "@catalog/types/shared";

import { getFormOptions } from "@/actions/series-actions";
import { SeriesCreateForm } from "@/components/series/series-create-form";

export default async function CreateSeriesPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  const { geographies, units, sources, sourceDetails } = await getFormOptions({
    universe: universe as Universe,
  });

  return (
    <SeriesCreateForm
      universe={universe}
      geographies={geographies}
      units={units}
      sources={sources}
      sourceDetails={sourceDetails}
    />
  );
}
