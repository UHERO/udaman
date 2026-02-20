import { ExportForm } from "@/components/exports/export-form";

export default async function ExportNewPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">New Export</h1>
      <ExportForm universe={universe} />
    </div>
  );
}
