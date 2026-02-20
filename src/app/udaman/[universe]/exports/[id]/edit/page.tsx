import { notFound } from "next/navigation";

import { getExportAction } from "@/actions/exports";
import { ExportForm } from "@/components/exports/export-form";

export default async function ExportEditPage({
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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Edit: {data.export.name}</h1>
      <ExportForm
        export={data.export}
        series={data.series}
        universe={universe}
      />
    </div>
  );
}
