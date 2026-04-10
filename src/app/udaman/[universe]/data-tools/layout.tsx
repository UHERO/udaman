import { DataToolsLayout } from "@/components/data-tools/data-tools-layout";
import { DataToolsTabs } from "@/components/data-tools/data-tools-tabs";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, universe } = await getCurrentUserContext();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <DataToolsTabs role={role} universe={universe} />
      <DataToolsLayout>{children}</DataToolsLayout>
    </div>
  );
}
