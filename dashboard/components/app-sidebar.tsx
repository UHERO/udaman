"use client";

import * as React from "react";
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
  user: {
    name: "wood2",
    email: "wood2@hawaii.edu",
    avatar: "/avatars/shadcn.jpg",
  },
  universes: [
    {
      name: "UHERO",
      logo: GalleryVerticalEnd,
      description: "",
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
      isActive: true,
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
          title: "Forecast Series Upload",
          url: "#",
        },
        {
          title: "CSV-to-TSD File Conversion",
          url: "#",
        },
        {
          title: "Series with no Source",
          url: "#",
        },
        {
          title: "Quarantined Series",
          url: "#",
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
      url: "#",
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
      url: "/file-conversion",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <UniverseSwitcher universes={data.universes} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDataPortals projects={data.dataPortal} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
