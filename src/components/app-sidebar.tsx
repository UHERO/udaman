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
  Command,
  FileSpreadsheet,
  GalleryVerticalEnd,
  HatGlasses,
  Settings,
  Settings2,
  TableProperties,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavDataPortals } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
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
    },
    {
      title: "Data Portal Catalog",
      url: "/catalog",
      icon: ChartLine,
    },
    {
      title: "Forecast Upload",
      url: "/series/forecast-upload",
      icon: ArrowUpToLine,
    },
    {
      title: "CSV-to-TSD",
      url: "/csv-to-tsd",
      icon: FileSpreadsheet,
    },
    {
      title: "Downloads",
      url: "/downloads",
      icon: ArrowDownToLine,
    },
    {
      title: "Exports",
      url: "/exports",
      icon: ArrowLeftFromLine,
    },
    {
      title: "Investigations",
      url: "/udaman/admin/investigations",
      icon: HatGlasses,
    },
    {
      title: "Docs",
      url: "/docs",
      icon: BookOpen,
    },
    {
      title: "Forecast Snapshots",
      url: "/forecast/snapshots",
      icon: BookOpen,
    },
    {
      title: "Feature Toggles",
      url: "/feature-toggles",
      icon: Settings,
    },
    {
      title: "Uploads",
      url: "/uploads",
      icon: ArrowUpToLine,
      items: [
        {
          title: "DBEDT Econ D/w",
          url: "/udaman/DBEDT/uploads",
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
      url: "/csv-to-tsd",
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
  };
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
    [universe]
  );

  const dataPortal = React.useMemo(
    () =>
      data.dataPortal.map((item) => ({
        ...item,
        url: prefixUrl(item.url, universe),
      })),
    [universe]
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
