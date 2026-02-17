import { Universe } from "@catalog/types/shared";

import { getSources } from "@/actions/sources";
import { SourcesListTable } from "@/components/sources/sources-list-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const data = await getSources({ universe: universe as Universe });

  return (
    <div>
      <h1 className="text-3xl font-bold">Sources</h1>
      <p className="text-muted-foreground text-sm">
        Manage source definitions for the data portal.
      </p>
      <div className="mt-4 min-h-screen flex-1 rounded-xl md:min-h-min">
        <SourcesListTable data={data} universe={universe as Universe} />
      </div>
    </div>
  );
}
