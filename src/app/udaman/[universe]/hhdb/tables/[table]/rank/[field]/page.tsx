import { notFound } from "next/navigation";
import { HHDB_TABLE_CONFIG, HHDB_TABLE_SLUGS } from "@/components/hhdb/hhdb-table-config";
import { getFieldsForViewType } from "@catalog/types/hhdb-data-dictionary";
import { HhdbSummaries } from "@/components/hhdb/hhdb-summaries";

export function generateStaticParams() {
  const result: { table: string; field: string }[] = [];
  for (const slug of HHDB_TABLE_SLUGS) {
    const config = HHDB_TABLE_CONFIG[slug];
    if (!config?.fieldsTable) continue;
    const fields = getFieldsForViewType(config.fieldsTable, "rank");
    if (!fields) continue;
    for (const f of fields) {
      if (!f.disabled) {
        result.push({ table: slug, field: f.key });
      }
    }
  }
  return result;
}

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
