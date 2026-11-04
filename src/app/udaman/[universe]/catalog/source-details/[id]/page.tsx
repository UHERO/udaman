import { notFound } from "next/navigation";
import type { Universe } from "@catalog/types/shared";

import { getSourceDetailDetail } from "@/actions/source-details";
import { SourceDetailEditButton } from "@/components/catalog/catalog-edit-buttons";
import { CatalogRecordDetail } from "@/components/catalog/catalog-record-detail";
import { parseSeriesPage } from "@/lib/series-page";

export default async function SourceDetailDetailPage({
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
    detail = await getSourceDetailDetail(numericId, seriesPage);
  } catch {
    notFound();
  }
  const { record: sd, series } = detail;

  return (
    <CatalogRecordDetail
      kind="Source Detail"
      title={sd.description || `Source detail ${sd.id}`}
      editButton={
        <SourceDetailEditButton
          sourceDetail={sd}
          universe={universe.toUpperCase() as Universe}
        />
      }
      fields={[
        { label: "Description", value: sd.description },
        { label: "Universe", value: sd.universe },
        { label: "ID", value: sd.id },
      ]}
      refKind="sourceDetail"
      series={series}
    />
  );
}
