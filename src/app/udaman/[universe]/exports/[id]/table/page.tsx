import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getExportMetadataAction,
  getExportTableDataAction,
} from "@/actions/exports";
import { Button } from "@/components/ui/button";
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
        <h1 className="text-3xl font-bold">{exp.name}</h1>
        <div className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={`${base}/${id}`}>Show</Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href={`${base}/${id}/edit`}>Edit</Link>
          </Button>
          <Button variant="link" size="sm" asChild>
            <a href={`/api/exports/${id}/csv`} download>
              CSV
            </a>
          </Button>
        </div>
      </div>
      <ExportTableView data={tableData} universe={universe} />
    </div>
  );
}
