import { NullFieldSeriesTable } from "@/components/series/null-field-series-table";

export default async function NoSourcePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Missing Metadata</h1>
        <p className="text-muted-foreground text-sm">
          Goal is 0, across all fields.
        </p>
      </div>
      <NullFieldSeriesTable universe={universe} />
    </>
  );
}
