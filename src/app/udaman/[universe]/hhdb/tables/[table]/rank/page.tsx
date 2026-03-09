import { notFound } from "next/navigation";
import { HHDB_TABLE_CONFIG, HHDB_TABLE_SLUGS } from "@/components/hhdb/hhdb-table-config";
import { HhdbSummaries } from "@/components/hhdb/hhdb-summaries";

export function generateStaticParams() {
  return HHDB_TABLE_SLUGS.map((table) => ({ table }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; table: string }>;
}) {
  const { universe, table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config) return notFound();

  if (!config.fieldsTable) {
    return (
      <p className="text-muted-foreground text-sm">
        No rank data available for this table.
      </p>
    );
  }

  const basePath = `/udaman/${universe}/hhdb/tables/${table}/rank`;
  return <HhdbSummaries tableName={config.fieldsTable} basePath={basePath} viewType="rank" />;
}
