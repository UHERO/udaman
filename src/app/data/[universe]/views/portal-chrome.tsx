import { SidebarProvider } from "@/components/ui/sidebar";

import { PortalHeader } from "../components/layout/portal-header";
import { PortalSidebar } from "../components/layout/portal-sidebar";

/**
 * Portal chrome (everything except the /graph embed). Used by both
 * `[universe]/(portal)/layout.tsx` and `(uhero)/(portal)/layout.tsx`.
 * Header + sidebar are solid white; the main area stays muted gray (set on
 * the wrapper in views/universe-layout.tsx) and holds white PortalCards.
 *
 * SidebarProvider also supplies the TooltipProvider used by AnalyzerToggle
 * and friends on every portal page.
 */
export function PortalChrome({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className="min-h-0 flex-1 flex-col"
      style={{ "--sidebar": "#ffffff" } as React.CSSProperties}
    >
      <PortalHeader />
      <div className="flex min-h-0 flex-1">
        <PortalSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
