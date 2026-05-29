"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { cn } from "@/lib/utils";

export function NavMain({
  items,
  label = "UDAMAN",
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
  label?: string;
}) {
  const pathname = useAppPathname();

  // Use longest-prefix matching so `/hhdb` doesn't highlight when
  // the user is on `/hhdb/tables/properties`.
  const activeUrl = items
    .map((item) => item.url)
    .filter((url) => pathname === url || pathname.startsWith(url + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active = item.url === activeUrl;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={active}
                className={cn(
                  active &&
                    "relative bg-ublue/10 text-ublue before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-full before:bg-ublue hover:bg-ublue/15 hover:text-ublue [&>svg]:text-ublue",
                )}
              >
                <Link href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
