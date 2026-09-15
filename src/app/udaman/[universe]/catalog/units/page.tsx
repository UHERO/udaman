import { Universe } from "@catalog/types/shared";

import { getUnits } from "@/actions/units";
import { UnitsListTable } from "@/components/units/units-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const data = await getUnits({ universe: universe as Universe });

  return (
    <div>
      <h1 className="text-3xl font-bold">Units</h1>
      <p className="text-muted-foreground text-sm">
        Manage unit definitions for the data portal.
      </p>
      <div className="mt-4 min-h-screen flex-1 rounded-xl md:min-h-min">
        <UnitsListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
