import Link from "next/link";
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

  const base = `/udaman/${universe}/exports`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.export.name}</h1>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <Link href={base} className="hover:underline">
              Back to Exports
            </Link>
            <Link href={`${base}/${id}/edit`} className="hover:underline">
              Edit
            </Link>
            <Link href={`${base}/${id}/table`} className="hover:underline">
              Table
            </Link>
            <a
              href={`/api/exports/${id}/csv`}
              download
              className="hover:underline"
            >
              CSV
            </a>
          </div>
        </div>
      </div>
      <ExportSeriesTable
        exportId={numericId}
        exportName={data.export.name ?? "Export"}
        series={data.series}
        universe={universe}
      />
    </div>
  );
}
