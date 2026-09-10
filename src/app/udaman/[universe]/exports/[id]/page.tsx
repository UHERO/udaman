import { notFound } from "next/navigation";

import { getExportAction } from "@/actions/exports";
import { ExportSeriesTable } from "@/components/exports/export-series-table";

export default async function ExportShowPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let data;
  try {
    data = await getExportAction(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <h1 className="text-3xl font-bold">{data.export.name}</h1>
      <ExportSeriesTable
        exportId={numericId}
        exportName={data.export.name ?? "Export"}
        series={data.series}
        universe={universe}
      />
    </div>
  );
}
