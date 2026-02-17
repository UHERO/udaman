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
    <div>
      <h1 className="text-3xl font-bold">Geographies</h1>
      <p className="text-muted-foreground text-sm">
        Manage geography definitions for the data portal.
      </p>
      <div className="mt-4 min-h-screen flex-1 rounded-xl md:min-h-min">
        <GeographiesListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
