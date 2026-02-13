import { Universe } from "@catalog/types/shared";

import { getGeographies } from "@/actions/geographies";
import { GeographiesListTable } from "@/components/geographies/geographies-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const data = await getGeographies({ universe: universe as Universe });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Geographies</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <GeographiesListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
