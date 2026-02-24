import { CatalogLayout } from "@/components/catalog/catalog-layout";
import { CatalogTabs } from "@/components/catalog/catalog-tabs";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { role, universe } = await getCurrentUserContext();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <CatalogTabs role={role} universe={universe} />
      <CatalogLayout>{children}</CatalogLayout>
    </div>
  );
}
