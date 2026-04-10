import { notFound } from "next/navigation";
import type { Universe } from "@catalog/types/shared";

import { getGeographies } from "@/actions/geographies";
import { getUniverses } from "@/actions/universes";
import { AppSidebar } from "@/components/app-sidebar";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import { NavSearchInput } from "@/components/nav-search";
import { PageViewLogger } from "@/components/page-view-logger";
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

  // Validate universe against the DB (not a hardcoded list).
  const allUniverses = await getUniverses();
  const matched = allUniverses.find(
    (u) => u.name.toUpperCase() === universe.toUpperCase(),
  );
  if (!matched) {
    notFound();
  }

  const session = await requireAuth();

  const user = {
    id: session.user.id ?? "",
    name: session.user.name ?? session.user.email ?? "User",
    email: session.user.email ?? "",
    avatar: session.user.image ?? "",
    createdAt: session.user.createdAt ?? "",
    role: session.user.role ?? "external",
    universe: session.user.universe ?? "UHERO",
  };

  const geographies = await getGeographies({
    universe: universe.toUpperCase() as Universe,
  });
  const geoHandles = geographies
    .map((g) => g.handle)
    .filter((h): h is string => h !== null);

  const universeOptions = allUniverses.map((u) => ({
    name: u.name,
    description: u.description,
  }));

  return (
    <SidebarProvider data-universe={universe.toUpperCase()}>
      <AppSidebar user={user} universes={universeOptions} />
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
      <PageViewLogger userId={parseInt(user.id) || 0} />
    </SidebarProvider>
  );
}
