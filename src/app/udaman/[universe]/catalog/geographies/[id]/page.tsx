import { notFound } from "next/navigation";
import type { Universe } from "@catalog/types/shared";

import { getGeographyDetail } from "@/actions/geographies";
import { GeographyEditButton } from "@/components/catalog/catalog-edit-buttons";
import { CatalogRecordDetail } from "@/components/catalog/catalog-record-detail";
import { GeographyMapPlaceholder } from "@/components/geographies/geography-map-placeholder";
import { parseSeriesPage } from "@/lib/series-page";

export default async function GeographyDetailPage({
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
    detail = await getGeographyDetail(numericId, seriesPage);
  } catch {
    notFound();
  }
  const { record: geo, series } = detail;

  return (
    <CatalogRecordDetail
      kind="Geography"
      title={geo.displayName || geo.handle || `Geography ${geo.id}`}
      subtitle={geo.displayName ? geo.handle : null}
      editButton={
        <GeographyEditButton
          geography={geo}
          universe={universe.toUpperCase() as Universe}
        />
      }
      fields={[
        { label: "Handle", value: geo.handle },
        { label: "Display name", value: geo.displayName },
        { label: "Short name", value: geo.displayNameShort },
        { label: "FIPS", value: geo.fips },
        { label: "Geotype", value: geo.geotype },
        { label: "List order", value: geo.listOrder },
        { label: "Universe", value: geo.universe },
        { label: "ID", value: geo.id },
      ]}
      aside={
        <GeographyMapPlaceholder
          name={geo.displayName || geo.handle || `Geography ${geo.id}`}
        />
      }
      refKind="geography"
      series={series}
    />
  );
}
