import type { Metadata } from "next";

import { AppSidebar } from "@/components/app-sidebar";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import { NavSearchInput } from "@/components/nav-search";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "udaman",
  description: "UHERO Data Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex w-full items-center justify-start gap-2 px-4">
            <div className="flex w-full items-center justify-start gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <NavBreadcrumb />
            </div>
            <NavSearchInput />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
