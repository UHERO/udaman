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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Units</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <UnitsListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
