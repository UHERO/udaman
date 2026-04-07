"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AudioWaveform, Command, GalleryVerticalEnd } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavDataPortals } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { UniverseSwitcher } from "@/components/universe-switcher";
import { getVisibleRoutes } from "@/lib/auth/route-access";

/** Per-universe icon overrides. Anything missing falls back to GalleryVerticalEnd. */
const UNIVERSE_ICONS: Record<string, React.ElementType> = {
  UHERO: GalleryVerticalEnd,
  NTA: AudioWaveform,
  FC: Command,
  CCOM: Command,
  DBEDT: Command,
  COH: Command,
};

function prefixUrl(url: string, universe: string): string {
  if (url.startsWith("/udaman/")) return url;
  if (url.startsWith("/")) return `/udaman/${universe}${url}`;
  return url;
}

export function AppSidebar({
  user,
  universes: allUniverses,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    createdAt: string;
    role: string;
    universe: string;
  };
  universes: { name: string; description: string | null }[];
}) {
  const params = useParams();
  const universe = (params.universe as string) || "uhero";

  // Filter by the URL universe (current context) so a UHERO user who has
  // switched to another universe sees routes scoped to that universe.
  const routes = React.useMemo(
    () => getVisibleRoutes(user.role, universe.toUpperCase()),
    [user.role, universe],
  );

  // Separate "Web Crawlers" section from main nav
  const mainRoutes = React.useMemo(
    () => routes.filter((r) => r.label !== "Web Crawlers"),
    [routes],
  );
  const portalRoutes = React.useMemo(
    () => routes.filter((r) => r.label === "Web Crawlers"),
    [routes],
  );

  const navMain = React.useMemo(
    () =>
      mainRoutes.map((entry) => ({
        title: entry.label,
        url: prefixUrl(entry.path, universe),
        icon: entry.icon,
        items: entry.children?.map((child) => ({
          title: child.label,
          url: prefixUrl(child.path, universe),
        })),
      })),
    [mainRoutes, universe],
  );

  const dataPortal = React.useMemo(
    () =>
      portalRoutes.flatMap((entry) =>
        entry.children
          ? entry.children.map((child) => ({
              name: child.label,
              url: prefixUrl(child.path, universe),
              icon: entry.icon,
            }))
          : [
              {
                name: entry.label,
                url: prefixUrl(entry.path, universe),
                icon: entry.icon,
              },
            ],
      ),
    [portalRoutes, universe],
  );

  // UHERO users can switch to any universe; others see only their own
  const universes = React.useMemo(() => {
    const decorated = allUniverses.map((u) => ({
      name: u.name,
      logo: UNIVERSE_ICONS[u.name.toUpperCase()] ?? GalleryVerticalEnd,
      description: u.description ?? u.name,
    }));
    if (user.universe.toUpperCase() === "UHERO") return decorated;
    return decorated.filter(
      (u) => u.name === user.universe.toUpperCase(),
    );
  }, [allUniverses, user.universe]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UniverseSwitcher universes={universes} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {dataPortal.length > 0 && <NavDataPortals projects={dataPortal} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
