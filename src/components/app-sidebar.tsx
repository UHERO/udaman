"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
} from "lucide-react";

import { getVisibleRoutes } from "@/lib/auth/route-access";
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

const ALL_UNIVERSES = [
  {
    name: "UHERO",
    logo: GalleryVerticalEnd,
    description: "UHERO",
  },
  {
    name: "NTA",
    logo: AudioWaveform,
    description: "National Trade Accounts",
  },
  {
    name: "FC",
    logo: Command,
    description: "Forecast",
  },
  {
    name: "CCOM",
    logo: Command,
    description: "Chamber of Commerce",
  },
  {
    name: "DBEDT",
    logo: Command,
    description: "Dept. of Economic Development & Tourism",
  },
  {
    name: "COH",
    logo: Command,
    description: "County of Hawaii",
  },
];

function prefixUrl(url: string, universe: string): string {
  if (url.startsWith("/udaman/")) return url;
  if (url.startsWith("/")) return `/udaman/${universe}${url}`;
  return url;
}

export function AppSidebar({
  user,
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
}) {
  const params = useParams();
  const universe = (params.universe as string) || "uhero";

  const routes = React.useMemo(
    () => getVisibleRoutes(user.role, user.universe),
    [user.role, user.universe],
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
          : [{ name: entry.label, url: prefixUrl(entry.path, universe), icon: entry.icon }],
      ),
    [portalRoutes, universe],
  );

  // UHERO users can switch to any universe; others see only their own
  const universes = React.useMemo(() => {
    if (user.universe.toUpperCase() === "UHERO") return ALL_UNIVERSES;
    return ALL_UNIVERSES.filter(
      (u) => u.name === user.universe.toUpperCase(),
    );
  }, [user.universe]);

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
