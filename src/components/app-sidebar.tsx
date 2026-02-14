"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowUpToLine,
  AudioWaveform,
  BookOpen,
  ChartLine,
  ClipboardList,
  Command,
  GalleryVerticalEnd,
  HatGlasses,
  Settings,
  Settings2,
  TableProperties,
} from "lucide-react";

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

const data = {
  universes: [
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
  ],
  navMain: [
    {
      title: "Data Series",
      url: "/series",
      icon: TableProperties,
      items: [
        {
          title: "List Series",
          url: "/series",
        },
        {
          title: "Create Series",
          url: "/series/create",
        },
        {
          title: "Forecast Upload",
          url: "/series/forecast-upload",
        },
        {
          title: "CSV-to-TSD",
          url: "/series/csv-to-tsd",
        },
        {
          title: "Missing Metadata",
          url: "/series/no-source",
        },
        {
          title: "Quarantine",
          url: "/series/quarantine",
        },
      ],
    },
    {
      title: "Clipboard",
      url: "/clipboard",
      icon: ClipboardList,
    },
    {
      title: "Downloads",
      url: "/downloads",
      icon: ArrowDownToLine,
    },
    {
      title: "Exports",
      url: "#",
      icon: ArrowLeftFromLine,
    },
    {
      title: "Investigations",
      url: "#",
      icon: HatGlasses,
    },
    {
      title: "Docs",
      url: "#",
      icon: BookOpen,
    },
    {
      title: "Data Portal",
      url: "#",
      icon: ChartLine,
      items: [
        {
          title: "Categories",
          url: "/categories",
        },
        {
          title: "Geographies",
          url: "/geographies",
        },
        {
          title: "Data Lists",
          url: "/data-list",
        },
        {
          title: "Measurements",
          url: "/measurement",
        },
        {
          title: "Sources",
          url: "/sources",
        },
        {
          title: "Source Details",
          url: "/source-details",
        },
        {
          title: "Units",
          url: "/units",
        },
      ],
    },
    {
      title: "Forecast Snapshots",
      url: "forecast-snapshots",
      icon: BookOpen,
      items: [
        {
          title: "New Export",
          url: "#",
        },
      ],
    },
    {
      title: "Feature Toggles",
      url: "feature-toggles",
      icon: Settings,
    },
    {
      title: "Uploads",
      url: "feature-toggles",
      icon: ArrowUpToLine,
      items: [
        {
          title: "DBEDT Econ D/w",
          url: "#",
        },
        {
          title: "DBEDT Tour D/w",
          url: "#",
        },
      ],
    },
  ],
  dataPortal: [
    {
      name: "Settings",
      url: "/settings",
      icon: Settings2,
    },
  ],
  utilities: [
    {
      name: "Bill Tracker",
      url: "/bill-tracker",
      icon: Settings2,
    },
    {
      name: "CSV-to-TSD file conversion",
      url: "/series/csv-to-tsd",
      icon: Settings2,
    },
    {
      name: "GeoCoder",
      url: "/geocoder",
      icon: Settings2,
    },
    {
      name: "CRON Logs",
      url: "/cron-logs",
      icon: Settings2,
    },
  ],
};

function prefixUrl(url: string, universe: string): string {
  if (url.startsWith("/")) return `/udaman/${universe}${url}`;
  return url;
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
}) {
  const params = useParams();
  const universe = (params.universe as string) || "uhero";

  const navMain = React.useMemo(
    () =>
      data.navMain.map((item) => ({
        ...item,
        url: prefixUrl(item.url, universe),
        items: item.items?.map((sub) => ({
          ...sub,
          url: prefixUrl(sub.url, universe),
        })),
      })),
    [universe],
  );

  const dataPortal = React.useMemo(
    () =>
      data.dataPortal.map((item) => ({
        ...item,
        url: prefixUrl(item.url, universe),
      })),
    [universe],
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UniverseSwitcher universes={data.universes} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDataPortals projects={dataPortal} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
