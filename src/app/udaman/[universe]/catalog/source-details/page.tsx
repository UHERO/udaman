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
    <div>
      <h1 className="text-3xl font-bold">Source Details</h1>
      <p className="text-muted-foreground text-sm">
        Manage source detail definitions for the data portal.
      </p>
      <div className="mt-4 min-h-screen flex-1 rounded-xl md:min-h-min">
        <SourceDetailsListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
