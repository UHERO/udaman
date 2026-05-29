import { notFound } from "next/navigation";

import { HhdbSummaries } from "@/components/hhdb/hhdb-summaries";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

export default async function Page({
  params,
}: {
  params: Promise<{ table: string; field: string }>;
}) {
  const { table, field } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const basePath = `/hhdb/tables/${table}/summary`;
  return (
    <HhdbSummaries
      tableName={config.fieldsTable}
      basePath={basePath}
      selectedField={field}
      viewType="summary"
    />
  );
}
