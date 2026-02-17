import { notFound } from "next/navigation";

import {
  getDataListForEdit,
  getMeasurementsForUniverse,
} from "@/actions/data-lists";
import { getSourceDetails } from "@/actions/source-details";
import { getSources } from "@/actions/sources";
import { getUnits } from "@/actions/units";
import { DataListEditForm } from "@/components/data-list/data-list-edit-form";
import { H1 } from "@/components/typography";
import type { Universe } from "@catalog/types/shared";

export default async function EditDataListPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const u = universe as Universe;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let data;
  try {
    data = await getDataListForEdit(numericId);
  } catch {
    notFound();
  }

  const [allMeasurements, unitsList, sourcesList, sourceDetailsList] =
    await Promise.all([
      getMeasurementsForUniverse(u),
      getUnits({ universe: u }),
      getSources({ universe: u }),
      getSourceDetails({ universe: u }),
    ]);

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
    <div className="flex flex-1 flex-col gap-6">
      <H1>Edit Data List: {data.dataList.name ?? `#${id}`}</H1>
      <DataListEditForm
        dataList={data.dataList}
        measurements={data.measurements}
        allMeasurements={allMeasurements}
        users={data.users}
        universe={u}
        units={units}
        sources={sources}
        sourceDetails={sourceDetails}
      />
    </div>
  );
}
