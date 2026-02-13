import { Universe } from "@catalog/types/shared";

import { getSourceDetails } from "@/actions/source-details";
import { SourceDetailsListTable } from "@/components/source-details/source-details-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const data = await getSourceDetails({ universe: universe as Universe });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Source Details</h1>
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <SourceDetailsListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
