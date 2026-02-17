import { getDataListSuperTableData } from "@/actions/data-lists";
import { SuperTable } from "@/components/data-list/super-table";
import { H1 } from "@/components/typography";

import type { Universe } from "@catalog/types/shared";

export default async function DataListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe, id } = await params;
  const sp = await searchParams;

  const freq = typeof sp.freq === "string" ? sp.freq : "A";
  const geo = typeof sp.geo === "string" ? sp.geo : "HI";
  const sa = typeof sp.sa === "string" ? sp.sa : "all";

  const data = await getDataListSuperTableData({
    id: Number(id),
    universe: universe as Universe,
    freq,
    geo,
    sa,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden p-4">
      <H1>{data.dataList.name ?? `Data List #${id}`}</H1>
      <SuperTable data={data} />
    </div>
  );
}
