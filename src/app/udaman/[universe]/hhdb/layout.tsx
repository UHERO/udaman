import { CatalogLayout } from "@/components/catalog/catalog-layout";
import { HhdbTabs } from "@/components/hhdb/hhdb-tabs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <HhdbTabs />
      <CatalogLayout>{children}</CatalogLayout>
    </div>
  );
}
