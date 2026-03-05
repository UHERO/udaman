import React from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

export default function Dvw_Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="flex h-screen flex-col overflow-hidden" style={{ "--sidebar": "white" } as React.CSSProperties}>
      <div className="flex min-h-0 flex-1">{children}</div>
    </SidebarProvider>
  );
}
