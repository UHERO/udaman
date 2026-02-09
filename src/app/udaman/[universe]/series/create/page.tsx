import { getFormOptions } from "@/actions/series-actions";
import Universe from "@/core/catalog/models/universe";
import { createLogger } from "@/core/observability/logger";

const log = createLogger("CreateSeriesPage");

export default async function CreateSeriesPage({
  params,
}: {
  params: Promise<{ universe: Universe }>;
}) {
  const { universe } = await params;

  const { geographies, units, sources, sourceDetails } = await getFormOptions({
    universe,
  });

  log.info(
    { geographies, units, sources, sourceDetails },
    "deleteSeriesDataPoints action called"
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <>Create Form</>
    </div>
  );
}
