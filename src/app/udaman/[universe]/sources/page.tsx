import { Universe } from "@catalog/types/shared";

import { getSources } from "@/actions/sources";
import { SourcesListTable } from "@/components/sources/sources-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: Universe }>;
}) {
  const { universe } = await params;
  const data = await getSources({ universe });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Sources</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <SourcesListTable data={data} universe={universe} />
      </div>
    </div>
  );
}
