import { notFound } from "next/navigation";

import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { ProfileOverviewTable } from "@/components/hhdb/profile/unified-profile";
import { getHhdbProfileOverview } from "@/actions/hhdb";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; table: string }>;
}) {
  const { universe, table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const overview = await getHhdbProfileOverview(config.fieldsTable);
  const basePath = `/udaman/${universe}/hhdb/tables/${table}/profile`;

  return <ProfileOverviewTable overview={overview} basePath={basePath} />;
}
