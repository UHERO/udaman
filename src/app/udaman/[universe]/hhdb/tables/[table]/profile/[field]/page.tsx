import { notFound } from "next/navigation";

import { getHhdbProfileOverview } from "@/actions/hhdb";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { ProfileFieldDrilldown } from "@/components/hhdb/profile/unified-profile";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; table: string; field: string }>;
}) {
  const { table, field } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const overview = await getHhdbProfileOverview(config.fieldsTable);
  const fieldRow = overview.rows.find((r) => r.columnName === field);
  if (!fieldRow) return notFound();

  return (
    <ProfileFieldDrilldown tableName={config.fieldsTable} field={fieldRow} />
  );
}
