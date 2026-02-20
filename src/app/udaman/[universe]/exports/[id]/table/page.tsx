import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getExportMetadataAction,
  getExportTableDataAction,
} from "@/actions/exports";
import { ExportTableView } from "@/components/exports/export-table-view";

export default async function ExportTablePage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let exp;
  let tableData;
  try {
    [exp, tableData] = await Promise.all([
      getExportMetadataAction(numericId),
      getExportTableDataAction(numericId),
    ]);
  } catch {
    notFound();
  }

  const base = `/udaman/${universe}/exports`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{exp.name}</h1>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <Link href={base} className="hover:underline">
              Back to Exports
            </Link>
            <Link href={`${base}/${id}`} className="hover:underline">
              Show
            </Link>
            <Link href={`${base}/${id}/edit`} className="hover:underline">
              Edit
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
      <ExportTableView data={tableData} universe={universe} />
    </div>
  );
}
