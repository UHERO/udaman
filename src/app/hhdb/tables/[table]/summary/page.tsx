import { notFound } from "next/navigation";

import { HhdbSummaries } from "@/components/hhdb/hhdb-summaries";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

export default async function Page({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config) return notFound();

  if (!config.fieldsTable) {
    return (
      <p className="text-muted-foreground text-sm">
        No summaries available for this table.
      </p>
    );
  }

  const basePath = `/hhdb/tables/${table}/summary`;
  return (
    <HhdbSummaries
      tableName={config.fieldsTable}
      basePath={basePath}
      viewType="summary"
    />
  );
}
