import { notFound } from "next/navigation";
import type { Universe } from "@catalog/types/shared";

import { getMeasurementDetail } from "@/actions/measurements";
import { getSourceDetails } from "@/actions/source-details";
import { getSources } from "@/actions/sources";
import { getUnits } from "@/actions/units";
import { MeasurementDetailView } from "@/components/measurements/measurement-detail-view";

export default async function MeasurementDetailPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const u = universe.toUpperCase() as Universe;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let measurement, series, unitsList, sourcesList, sourceDetailsList;
  try {
    [{ measurement, series }, unitsList, sourcesList, sourceDetailsList] =
      await Promise.all([
        getMeasurementDetail(numericId),
        getUnits({ universe: u }),
        getSources({ universe: u }),
        getSourceDetails({ universe: u }),
      ]);
  } catch {
    notFound();
  }

  const units = unitsList.map((unit) => ({
    id: unit.id,
    label: unit.shortLabel || unit.longLabel || `ID: ${unit.id}`,
  }));

  const sources = sourcesList.map((s) => ({
    id: s.id,
    label: s.description || `ID: ${s.id}`,
  }));

  const sourceDetails = sourceDetailsList.map((sd) => ({
    id: sd.id,
    label: sd.description || `ID: ${sd.id}`,
  }));

  return (
    <MeasurementDetailView
      measurement={measurement}
      series={series}
      universe={u}
      units={units}
      sources={sources}
      sourceDetails={sourceDetails}
    />
  );
}
