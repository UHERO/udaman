import { notFound } from "next/navigation";
import type { Universe } from "@catalog/types/shared";

import { getUnitDetail } from "@/actions/units";
import { UnitEditButton } from "@/components/catalog/catalog-edit-buttons";
import { CatalogRecordDetail } from "@/components/catalog/catalog-record-detail";
import { parseSeriesPage } from "@/lib/series-page";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe, id } = await params;
  const seriesPage = parseSeriesPage(await searchParams);
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  let detail;
  try {
    detail = await getUnitDetail(numericId, seriesPage);
  } catch {
    notFound();
  }
  const { record: unit, series } = detail;

  return (
    <CatalogRecordDetail
      kind="Unit"
      title={unit.shortLabel || unit.longLabel || `Unit ${unit.id}`}
      subtitle={unit.shortLabel ? unit.longLabel : null}
      editButton={
        <UnitEditButton
          unit={unit}
          universe={universe.toUpperCase() as Universe}
        />
      }
      fields={[
        { label: "Short label", value: unit.shortLabel },
        { label: "Long label", value: unit.longLabel },
        { label: "Universe", value: unit.universe },
        { label: "ID", value: unit.id },
      ]}
      refKind="unit"
      series={series}
    />
  );
}
