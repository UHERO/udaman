import { Universe } from "@catalog/types/shared";

import { getDataLists } from "@/actions/data-lists";
import { DataListsListTable } from "@/components/data-lists/data-lists-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const data = await getDataLists({ universe: universe as Universe });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Data Lists</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <DataListsListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
