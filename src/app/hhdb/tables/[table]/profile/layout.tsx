import { notFound } from "next/navigation";

import { getHhdbProfileOverview } from "@/actions/hhdb";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";
import { ProfileSidebar } from "@/components/hhdb/profile/profile-sidebar";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ table: string }>;
  children: React.ReactNode;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.fieldsTable) return notFound();

  const overview = await getHhdbProfileOverview(config.fieldsTable);
  const basePath = `/hhdb/tables/${table}/profile`;

  return (
    <div className="flex gap-6">
      <ProfileSidebar
        fields={overview.rows.map((r) => ({
          columnName: r.columnName,
          label: r.label,
          fieldCategory: r.fieldCategory,
        }))}
        basePath={basePath}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
