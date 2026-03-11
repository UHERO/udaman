import { notFound } from "next/navigation";

import { HhdbSummaries } from "@/components/hhdb/hhdb-summaries";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; table: string; field: string }>;
}) {
  const { universe, table, field } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const basePath = `/udaman/${universe}/hhdb/tables/${table}/rank`;
  return (
    <HhdbSummaries
      tableName={config.fieldsTable}
      basePath={basePath}
      selectedField={field}
      viewType="rank"
    />
  );
}
