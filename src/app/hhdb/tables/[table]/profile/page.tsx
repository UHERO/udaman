import { notFound } from "next/navigation";

import { getHhdbProfileOverview } from "@/actions/hhdb";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { ProfileOverviewTable } from "@/components/hhdb/profile/unified-profile";

export default async function Page({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const overview = await getHhdbProfileOverview(config.fieldsTable);
  const basePath = `/hhdb/tables/${table}/profile`;

  return <ProfileOverviewTable overview={overview} basePath={basePath} />;
}
