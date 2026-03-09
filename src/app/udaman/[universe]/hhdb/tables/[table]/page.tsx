import { notFound } from "next/navigation";

import {
  HHDB_TABLE_CONFIG,
  HHDB_TABLE_SLUGS,
} from "@/components/hhdb/hhdb-table-config";
import { HhdbTablePage } from "@/components/hhdb/hhdb-table-page";

export function generateStaticParams() {
  return HHDB_TABLE_SLUGS.map((table) => ({ table }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config) return notFound();

  return <HhdbTablePage slug={table} config={config} />;
}
