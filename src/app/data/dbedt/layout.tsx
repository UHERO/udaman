import React from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

export default async function DbedtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="flex flex-col" style={{ "--sidebar": "white" } as React.CSSProperties}>
      <div className="flex flex-1">{children}</div>
    </SidebarProvider>
  );
}
