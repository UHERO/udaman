import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * The bar every app shell (udaman, admin, hhdb, docs, comms, data-registry)
 * puts at the top of `SidebarInset`: sidebar toggle, breadcrumb, and an
 * optional actions slot on the right.
 *
 * Shorter and tighter on a small screen. The width breakpoint alone misses a
 * phone held in landscape — wide but only ~390px tall — so a short viewport
 * gets the compact height too.
 */
export function AppHeader({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 px-3 transition-[width,height] ease-linear sm:h-16 sm:px-4",
        "short:h-12",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        className,
      )}
    >
      <SidebarTrigger className="-ml-1 shrink-0" />
      <Separator
        orientation="vertical"
        className="mr-1 shrink-0 data-[orientation=vertical]:h-4 sm:mr-2"
      />
      {/* min-w-0 so a long page name truncates instead of pushing the
          actions slot (or the page itself) off-screen. A phone row is too
          narrow to share, so actions win it outright and the crumb — which
          on mobile is just the current page name — steps aside. */}
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden",
          children && "hidden sm:block",
        )}
      >
        <NavBreadcrumb />
      </div>
      {children}
    </header>
  );
}
