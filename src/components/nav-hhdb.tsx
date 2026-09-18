"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building,
  ChevronRight,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Gavel,
  Hammer,
  History,
  Home,
  House,
  Info,
  Landmark,
  Layers,
  ListOrdered,
  MapPin,
  PlusSquare,
  Receipt,
  ScrollText,
  TreePine,
  Users,
  Warehouse,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavLeaf = { title: string; url: string; icon: LucideIcon };
type NavGroup = {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  items: NavLeaf[];
};
type NavEntry = NavLeaf | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const T = "/hhdb/tables";

/** Sidebar nav grouped by data source, then by subject area. */
const SECTIONS: { label: string; entries: NavEntry[] }[] = [
  {
    label: "qPublic",
    entries: [
      { title: "About", url: "/hhdb", icon: Info },
      {
        title: "Property",
        icon: Home,
        defaultOpen: true,
        items: [
          { title: "Properties", url: `${T}/properties`, icon: Home },
          { title: "Parcels", url: `${T}/parcels`, icon: MapPin },
          { title: "Owners", url: `${T}/owners`, icon: Users },
          { title: "Sales", url: `${T}/sales`, icon: Landmark },
          { title: "Permits", url: `${T}/permits`, icon: FileText },
          { title: "Assessments", url: `${T}/assessments`, icon: DollarSign },
        ],
      },
      {
        title: "Improvements",
        icon: Hammer,
        items: [
          {
            title: "Residential Impr.",
            url: `${T}/residential-improvements`,
            icon: Hammer,
          },
          {
            title: "Residential Add.",
            url: `${T}/residential-additions`,
            icon: PlusSquare,
          },
          {
            title: "Accessory Impr.",
            url: `${T}/accessory-improvements`,
            icon: TreePine,
          },
          {
            title: "Commercial Impr.",
            url: `${T}/commercial-improvements`,
            icon: Warehouse,
          },
          {
            title: "Commercial Details",
            url: `${T}/commercial-details`,
            icon: Warehouse,
          },
        ],
      },
      {
        title: "Condo",
        icon: Building,
        items: [
          { title: "Condo Projects", url: `${T}/condo-projects`, icon: Building },
          { title: "Condo Units", url: `${T}/condo-units`, icon: Building },
        ],
      },
      {
        title: "Tax",
        icon: Receipt,
        items: [
          { title: "Tax Bills", url: `${T}/tax-bills`, icon: Receipt },
          { title: "Tax History", url: `${T}/tax-summary`, icon: History },
          { title: "Tax Details", url: `${T}/tax-details`, icon: ListOrdered },
          { title: "Tax Payments", url: `${T}/tax-payments`, icon: CreditCard },
          { title: "Tax Credits", url: `${T}/tax-credits`, icon: Coins },
          { title: "Appeals", url: `${T}/appeals`, icon: Gavel },
          { title: "Home Exemptions", url: `${T}/home-exemptions`, icon: House },
        ],
      },
      {
        title: "Land",
        icon: Layers,
        items: [
          {
            title: "Land Class",
            url: `${T}/land-classifications`,
            icon: Layers,
          },
          { title: "Agg. Assessments", url: `${T}/ag-assessments`, icon: Wheat },
          { title: "Dedications", url: `${T}/dedications`, icon: BookOpen },
        ],
      },
    ],
  },
  {
    label: "Title Guaranty",
    entries: [
      { title: "Transactions", url: `${T}/transactions`, icon: ScrollText },
    ],
  },
];

const ACTIVE_CLASSES =
  "bg-ublue/10 text-ublue before:bg-ublue hover:bg-ublue/15 hover:text-ublue [&>svg]:text-ublue relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-full";

function isActiveUrl(pathname: string, url: string): boolean {
  // Exact match for the About landing page; prefix match for table routes.
  if (url === "/hhdb") return pathname === "/hhdb";
  return pathname === url || pathname.startsWith(`${url}/`);
}

function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const containsActive = group.items.some((i) => isActiveUrl(pathname, i.url));
  const [open, setOpen] = useState(group.defaultOpen || containsActive);

  // Navigating into a closed group (e.g. via the tab bar) opens it.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
      asChild
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <group.icon />
            <span>{group.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((item) => {
              const active = isActiveUrl(pathname, item.url);
              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={active}
                    className={cn(active && ACTIVE_CLASSES)}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavHhdb() {
  const pathname = usePathname();

  return (
    <>
      {SECTIONS.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarMenu>
            {section.entries.map((entry) =>
              isGroup(entry) ? (
                <NavGroupItem
                  key={entry.title}
                  group={entry}
                  pathname={pathname}
                />
              ) : (
                <SidebarMenuItem key={entry.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActiveUrl(pathname, entry.url)}
                    className={cn(
                      isActiveUrl(pathname, entry.url) && ACTIVE_CLASSES,
                    )}
                  >
                    <Link href={entry.url}>
                      <entry.icon />
                      <span>{entry.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
