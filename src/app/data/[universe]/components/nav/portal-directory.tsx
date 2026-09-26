"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, LayoutGrid } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { PORTAL_CONFIGS } from "../../lib/config";
import { PORTAL_BASE, portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";

/** Main UHERO dashboards site (the sidebar's old direct link). */
const DASHBOARD_PROJECT_URL = "https://uhero.hawaii.edu/analytics-dashboards/";

/**
 * Public portals listed in the directory, in display order. Registry
 * universes take their title from config; `dvw`/`dbedt` are the custom
 * dashboards under /data. Curated rather than read from the `universes`
 * table so internal universes never surface on the public site.
 */
const DIRECTORY: { slug: string; name?: string; description: string }[] = [
  { slug: "uhero", description: "Hawaiʻi economic indicators by county" },
  { slug: "fc", description: "UHERO forecast series and history" },
  {
    slug: "dvw",
    name: "Tourism Data Warehouse",
    description: "Visitor arrivals, spending, and hotel performance",
  },
  {
    slug: "dbedt",
    name: "DBEDT Data Warehouse",
    description: "State of Hawaiʻi DBEDT statistics",
  },
  { slug: "nta", description: "National Transfer Accounts" },
  { slug: "ccom", description: "Chamber of Commerce Hawaii indicators" },
];

function directoryEntry(entry: (typeof DIRECTORY)[number]) {
  const config = PORTAL_CONFIGS[entry.slug];
  return {
    ...entry,
    name: entry.name ?? config?.title ?? entry.slug.toUpperCase(),
    href: config ? portalHref(entry.slug) : `${PORTAL_BASE}/${entry.slug}`,
  };
}

/**
 * Sidebar "UHERO Dashboard Project" entry: opens a dialog listing every data
 * portal (the current one highlighted), then the external dashboard links —
 * the main UHERO dashboards site plus the universe's otherDashboardLinks.
 * Header and footer bands use the theme color.
 */
export function PortalDirectory({ onNavigate }: { onNavigate?: () => void }) {
  const { config } = usePortalConfig();
  const portals = DIRECTORY.map(directoryEntry);
  const external = [
    { name: "UHERO Dashboard Project", url: DASHBOARD_PROJECT_URL },
    ...config.otherDashboardLinks.filter(
      (d) => d.name && d.url !== DASHBOARD_PROJECT_URL,
    ),
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton className="text-muted-foreground rounded-none">
          <LayoutGrid />
          <span>UHERO Dashboard Project</span>
        </SidebarMenuButton>
      </DialogTrigger>
      {/* Dialogs portal to <body>, outside .data-portal, so re-declare the
          theme var here for the var(--portal-primary) classes below. */}
      <DialogContent
        className="gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-md [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:opacity-80 [&>[data-slot=dialog-close]]:data-[state=open]:bg-transparent [&>[data-slot=dialog-close]]:data-[state=open]:text-white"
        style={
          { "--portal-primary": config.colors.primary } as React.CSSProperties
        }
      >
        <DialogHeader className="bg-(--portal-primary) px-5 py-4 text-white">
          <DialogTitle>UHERO Data Portals</DialogTitle>
          <DialogDescription className="text-white/80">
            Explore our other data portals and dashboards.
          </DialogDescription>
        </DialogHeader>

        <ul className="py-1">
          {portals.map((p) => {
            const current = p.slug === config.universe;
            return (
              <li key={p.slug}>
                <Link
                  href={p.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "group flex items-start justify-between gap-3 border-l-3 px-5 py-2.5",
                    current
                      ? "border-(--portal-primary) bg-[color-mix(in_srgb,var(--portal-primary)_8%,white)]"
                      : "border-transparent hover:bg-neutral-50",
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium group-hover:text-(--portal-primary)",
                        current && "text-(--portal-primary)",
                      )}
                    >
                      {p.name}
                      {current && (
                        <span className="ml-2 text-[10px] font-semibold tracking-wider uppercase">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {p.description}
                    </span>
                  </span>
                  {!current && (
                    <ArrowUpRight className="text-muted-foreground mt-0.5 size-4 shrink-0 group-hover:text-(--portal-primary)" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="bg-(--portal-primary) py-1">
          {external.map((d) => (
            <a
              key={d.url}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white"
            >
              {d.name}
              <ExternalLink className="size-4 shrink-0" />
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
