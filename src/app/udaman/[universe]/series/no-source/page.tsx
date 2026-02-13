import { NullFieldSeriesTable } from "@/components/series/null-field-series-table";
import { H1 } from "@/components/typography";

export default async function NoSourcePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  return (
    <div className="flex flex-col gap-4 p-4">
      <H1>Missing Metadata</H1>
      <p className="font-mono text-4xl">Goal is 0, across all fields</p>
      <NullFieldSeriesTable universe={universe} />
    </div>
  );
}
