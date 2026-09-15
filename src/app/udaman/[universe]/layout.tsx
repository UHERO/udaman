import { notFound } from "next/navigation";
import GeographyCollection from "@catalog/collections/geography-collection";
import UniverseCollection from "@catalog/collections/universe-collection";
import type { Universe } from "@catalog/types/shared";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { NavSearchInput } from "@/components/nav-search";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth/dal";
import { getReadableResources } from "@/lib/auth/readable-resources";

export default async function UniverseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ universe: string }>;
}) {
  // Auth gate first — unauthenticated users redirect to /udaman (login)
  const session = await requireAuth();

  const { universe } = await params;

  // Validate universe against the DB (not a hardcoded list).
  // Uses collection directly — no permission gate needed for layout navigation data.
  const allUniverses = await UniverseCollection.list();
  const matched = allUniverses.find(
    (u) => u.name.toUpperCase() === universe.toUpperCase(),
  );
  if (!matched) {
    notFound();
  }

  const user = {
    id: session.user.id ?? "",
    name: session.user.name ?? session.user.email ?? "User",
    email: session.user.email ?? "",
    avatar: session.user.image ?? "",
    createdAt: session.user.createdAt ?? "",
    role: session.user.role ?? "external",
    universe: session.user.universe ?? "UHERO",
  };

  const readableResources = await getReadableResources(user.role);

  const geographies = await GeographyCollection.list({
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
      <AppSidebar
        user={user}
        readableResources={readableResources}
        mode="udaman"
        universes={universeOptions}
      />
      <SidebarInset>
        <AppHeader>
          <NavSearchInput geoHandles={geoHandles} />
        </AppHeader>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
