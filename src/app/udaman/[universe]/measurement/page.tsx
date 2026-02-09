import { Universe } from "@catalog/types/shared";

import { getMeasurements } from "@/actions/measurements";
import { getUnits } from "@/actions/units";
import { getSources } from "@/actions/sources";
import { getSourceDetails } from "@/actions/source-details";
import { MeasurementsListTable } from "@/components/measurements/measurements-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: Universe }>;
}) {
  const { universe } = await params;
  const [data, unitsList, sourcesList, sourceDetailsList] = await Promise.all([
    getMeasurements({ universe }),
    getUnits({ universe }),
    getSources({ universe }),
    getSourceDetails({ universe }),
  ]);

  const units = unitsList.map((u) => ({
    id: u.id,
    label: u.shortLabel || u.longLabel || `ID: ${u.id}`,
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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Measurements</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <MeasurementsListTable
          data={data}
          universe={universe}
          units={units}
          sources={sources}
          sourceDetails={sourceDetails}
        />
      </div>
    </div>
  );
}
