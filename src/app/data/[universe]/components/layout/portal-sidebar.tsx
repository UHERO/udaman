"use client";

import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

import { usePortalConfig } from "../../lib/portal-context";
import { CategoryNav } from "../nav/category-nav";
import { PortalLogo } from "./portal-logo";
import { SearchBox } from "./search-box";

/**
 * White left sidebar (port of primeng-menu-nav's container). Desktop: fixed
 * under the 56px header. Mobile: shadcn sheet with the logo + search bar on
 * top (the header search is hidden on small screens, as in Angular).
 */
export function PortalSidebar() {
  const { config } = usePortalConfig();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="rounded-none border-neutral-200 bg-white md:top-14 md:h-[calc(100svh-3.5rem)]"
    >
      {isMobile && (
        <SidebarHeader className="gap-3 border-b border-neutral-200 p-3">
          <PortalLogo
            sizes="192px"
            className="mx-auto h-10 w-auto max-w-48 object-contain"
            wordmarkClassName="mx-auto text-[32px]"
          />
          <SearchBox onSearched={close} />
        </SidebarHeader>
      )}
      {/* Reserve the scrollbar's space so expanding items never shifts the
          layout; thin square thumb (WebKit/Blink), `thin` on Firefox. */}
      <SidebarContent className="[scrollbar-gutter:stable] gap-0 bg-white py-1 supports-[not_selector(::-webkit-scrollbar)]:[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-none [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb:hover]:bg-neutral-400 [&::-webkit-scrollbar-track]:bg-transparent">
        <CategoryNav onNavigate={close} />
      </SidebarContent>
      {config.logo.analyticsSrc && (
        <SidebarFooter className="border-t border-neutral-200 bg-white px-4 py-3">
          <a
            href="https://uhero.hawaii.edu/uhero-analytics/"
            className="flex items-end gap-2"
          >
            <span className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Built by
            </span>
            <Image
              src={config.logo.analyticsSrc}
              alt="UHERO Analytics"
              width={141}
              height={68}
              sizes="50px"
              className="h-6 w-auto"
            />
          </a>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
