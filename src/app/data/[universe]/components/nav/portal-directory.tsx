"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, LayoutDashboard } from "lucide-react";

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
/** Public REST API docs (keys are issued on request by email). */
const REST_API_DOCS_URL = "https://api.uhero.hawaii.edu/docs/#";

type DirectoryEntry = { slug: string; name: string; description: string };

/**
 * Public portals listed in the directory, grouped and in display order.
 * `dvw`/`dbedt` are the custom dashboards under /data. Curated rather than
 * read from the `universes` table so internal universes never surface on
 * the public site.
 */
const DIRECTORY_GROUPS: { label: string; entries: DirectoryEntry[] }[] = [
  {
    label: "Data Portals",
    entries: [
      {
        slug: "uhero",
        name: "Data Portal",
        description: "Hawaiʻi economic indicators by county",
      },
      {
        slug: "nta",
        name: "National Transfer Accounts",
        description: "Population age structure and the economic life cycle",
      },
      {
        slug: "ccom",
        name: "Chamber of Commerce Hawaii",
        description: "Chamber of Commerce Hawaii indicators",
      },
      {
        slug: "fc",
        name: "Forecast",
        description: "UHERO forecast series and history",
      },
    ],
  },
  {
    label: "DBEDT",
    entries: [
      {
        slug: "dvw",
        name: "Tourism Data Warehouse",
        description: "Visitor arrivals, spending, and hotel performance",
      },
      {
        slug: "dbedt",
        name: "Economic Data Warehouse",
        description: "State of Hawaiʻi DBEDT statistics",
      },
    ],
  },
];

const entryHref = (slug: string) =>
  PORTAL_CONFIGS[slug] ? portalHref(slug) : `${PORTAL_BASE}/${slug}`;

/**
 * Sidebar "UHERO Dashboard Project" entry: opens a dialog listing every data
 * portal (the current one highlighted), then the external dashboard links —
 * the main UHERO dashboards site plus the universe's otherDashboardLinks.
 * Header and footer bands use the theme color.
 */
export function PortalDirectory({ onNavigate }: { onNavigate?: () => void }) {
  const { config } = usePortalConfig();
  const external: { name: string; url: string; description?: string }[] = [
    { name: "UHERO Dashboard Project", url: DASHBOARD_PROJECT_URL },
    ...config.otherDashboardLinks.filter(
      (d) => d.name && d.url !== DASHBOARD_PROJECT_URL,
    ),
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton className="text-muted-foreground rounded-none">
          <LayoutDashboard />
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

        <div className="py-1">
          {DIRECTORY_GROUPS.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="text-muted-foreground px-5 pt-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                {group.label}
              </h3>
              <ul>
                {group.entries.map((p) => {
                  const current = p.slug === config.universe;
                  return (
                    <li key={p.slug}>
                      <Link
                        href={entryHref(p.slug)}
                        onClick={onNavigate}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "group flex items-center justify-between gap-3 border-l-3 px-5 py-2",
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
                          <ArrowUpRight className="text-muted-foreground size-4 shrink-0 group-hover:text-(--portal-primary)" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Not a data portal: muted gray band between the list and the
            theme-colored dashboard links. */}
        <a
          href={REST_API_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-100 px-5 py-2.5 hover:bg-neutral-200/70"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-neutral-700">
              UHERO REST API
            </span>
            <span className="block text-xs text-neutral-500">
              Email uhero@hawaii.edu to request an API key.
            </span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-neutral-500" />
        </a>

        <div className="bg-(--portal-primary) py-1">
          {external.map((d) => (
            <a
              key={d.url}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white"
            >
              <span className="min-w-0">
                <span className="block">{d.name}</span>
                {d.description && (
                  <span className="block text-xs text-white/70">
                    {d.description}
                  </span>
                )}
              </span>
              <ExternalLink className="size-4 shrink-0" />
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
