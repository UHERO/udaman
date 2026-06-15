import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { HhdbTablePage } from "@/components/hhdb/hhdb-table-page";

export default async function Page({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config) return notFound();

  // Tables without a fieldsTable have no table view — redirect to exploration
  if (!config.fieldsTable && config.exploration) {
    redirect(`/hhdb/tables/${table}/exploration`);
  }

  return <HhdbTablePage slug={table} config={config} />;
}
