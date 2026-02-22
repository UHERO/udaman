import { listExportsAction } from "@/actions/exports";
import { ExportListTable } from "@/components/exports/export-list-table";

export default async function Page() {
  const data = await listExportsAction();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div>
        <h1 className="text-3xl font-bold">Exports</h1>
        <p className="text-muted-foreground text-sm">
          Named collections of series for download and charting.
        </p>
      </div>
      <div className="max-w-2xl">
        <ExportListTable data={data} />
      </div>
    </div>
  );
}
