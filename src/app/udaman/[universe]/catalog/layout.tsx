import { CatalogLayout } from "@/components/catalog/catalog-layout";
import { CatalogTabs } from "@/components/catalog/catalog-tabs";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, universe } = await getCurrentUserContext();
  const readableResources = await getReadableResources(role);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <CatalogTabs
        role={role}
        universe={universe}
        readableResources={readableResources}
      />
      <CatalogLayout>{children}</CatalogLayout>
    </div>
  );
}
