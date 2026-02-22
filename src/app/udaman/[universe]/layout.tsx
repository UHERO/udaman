import { notFound } from "next/navigation";
import GeographyCollection from "@catalog/collections/geography-collection";
import type { Universe } from "@catalog/types/shared";
import { isValidUniverse } from "@catalog/utils/validators";
import { mysql } from "@database/mysql";

import { AppSidebar } from "@/components/app-sidebar";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import { NavSearchInput } from "@/components/nav-search";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/dal";

export default async function UniverseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  if (!isValidUniverse(universe)) {
    notFound();
  }

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
  };

  const geographies = await GeographyCollection.list({
    universe: universe.toUpperCase() as Universe,
  });
  const geoHandles = geographies
    .map((g) => g.handle)
    .filter((h): h is string => h !== null);

  return (
    <SidebarProvider data-universe={universe.toUpperCase()}>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center justify-start gap-2 px-4">
            <div className="flex w-full items-center justify-start gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <NavBreadcrumb />
            </div>
            <NavSearchInput geoHandles={geoHandles} />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
