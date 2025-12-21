import { Universe } from "@shared/types/shared";
import { getGeographies } from "actions/geographies";

import { GeographiesListTable } from "@/components/geographies/geographies-list-table";

export default async function Page({
  searchParams,
}: {
  searchParams: { u: Universe | undefined };
}) {
  const { u } = await searchParams;
  const data = await getGeographies({ universe: u });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Geographies</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <GeographiesListTable data={data} universe={u} />
      </div>
    </div>
  );
}
