import { notFound } from "next/navigation";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { HhdbTableLayout } from "@/components/hhdb/hhdb-table-layout";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ universe: string; table: string }>;
  children: React.ReactNode;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config) return notFound();

  return (
    <HhdbTableLayout
      title={config.title}
      segment={table}
      fieldsTable={config.fieldsTable}
      warningBanner={
        config.warning ? (
          <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            {config.warning}
          </div>
        ) : undefined
      }
    >
      {children}
    </HhdbTableLayout>
  );
}
