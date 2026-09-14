import { mysql } from "@database/mysql";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { CatalogLayout } from "@/components/catalog/catalog-layout";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";

export default async function HhdbLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const userId = session.user?.id;

  let createdAt = "";
  if (userId) {
    const rows = await mysql<{ created_at: Date | string | null }>`
      SELECT created_at FROM users WHERE id = ${userId}
    `;
    if (rows[0]?.created_at) {
      createdAt = new Date(rows[0].created_at as string | Date).toISOString();
    }
  }

  const user = {
    id: userId ?? "",
    name: session.user?.name ?? session.user?.email ?? "User",
    email: session.user?.email ?? "",
    avatar: session.user?.image ?? "",
    createdAt,
    role: session.user.role ?? "external",
    universe: session.user.universe ?? "UHERO",
  };

  const readableResources = await getReadableResources(user.role);

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        readableResources={readableResources}
        mode="hhdb"
      />
      <SidebarInset>
        <AppHeader />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
          <CatalogLayout>{children}</CatalogLayout>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
