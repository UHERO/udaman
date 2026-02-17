import { CatalogLayout } from "@/components/catalog/catalog-layout";
import { CatalogTabs } from "@/components/catalog/catalog-tabs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <CatalogTabs />
      <CatalogLayout>{children}</CatalogLayout>
    </div>
  );
}
