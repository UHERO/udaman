"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown, GalleryVerticalEnd, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const defaultU = {
  name: "UHERO",
  logo: GalleryVerticalEnd as React.ElementType,
  description: "Primary Universe",
};

export function UniverseSwitcher({
  universes,
}: {
  universes: {
    name: string;
    logo: React.ElementType;
    description: string;
  }[];
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeUniverse, setActiveUniverse] = React.useState(defaultU);

  React.useEffect(() => {
    if (!activeUniverse) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("u", activeUniverse.name);
    router.replace(`?${params.toString()}`);
  }, [activeUniverse, searchParams, router]);

  React.useEffect(() => {
    const universeFromUrl = searchParams.get("u");

    if (universeFromUrl) {
      const foundUniverse = universes.find((u) => u.name === universeFromUrl);
      if (foundUniverse !== undefined) {
        setActiveUniverse(foundUniverse);
      }
    } else {
      setActiveUniverse(defaultU);
    }
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <activeUniverse.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeUniverse.name}
                </span>
                <span className="truncate text-xs">
                  {activeUniverse.description}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Data Universes
            </DropdownMenuLabel>
            {universes.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveUniverse(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                Add universe
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
