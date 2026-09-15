import { mysql } from "@database/mysql";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";

export default async function DocsLayout({
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
        mode="docs"
      />
      <SidebarInset>
        <AppHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
