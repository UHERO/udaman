"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const segmentLabels: Record<string, string> = {
  series: "Series",
  catalog: "Catalog",
  categories: "Categories",
  geographies: "Geographies",
  "data-lists": "Data Lists",
  measurements: "Measurements",
  units: "Units",
  sources: "Sources",
  "source-details": "Source Details",
  "data-loaders": "Data Loaders",
  clipboard: "Clipboard",
  downloads: "Downloads",
  analyze: "Analyze",
  compare: "Compare",
  calculate: "Calculate",
  quarantine: "Quarantine",
  "no-source": "Missing Metadata",
  "forecast-upload": "Forecast Upload",
  "data-tools": "Data Tools",
  docs: "Docs",
  "it-infrastructure": "IT Infrastructure",
  tsd: "TSD Convert & Inspect",
  new: "New",
  edit: "Edit",
  duplicate: "Duplicate",
  create: "Create",
  // Admin segments
  "feature-toggles": "Feature Toggles",
  workers: "Workers",
  schedules: "Schedules",
  users: "Users",
  logs: "Logs",
  crawlers: "Crawlers",
  stats: "Stats",
  "api-keys": "API Keys",
  // HHDB segments
  tables: "Tables",
  profile: "Profile",
  summary: "Summary",
};

/** Fallback: convert kebab-case segment to Title Case */
function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type AppPrefix = {
  rootLabel: string;
  rootHref: string;
  crumbSegments: string[];
  basePath: string;
};

function parsePathname(pathname: string): AppPrefix {
  if (pathname.startsWith("/admin")) {
    const segments = pathname
      .replace(/^\/admin\/?/, "")
      .split("/")
      .filter(Boolean);
    return {
      rootLabel: "Admin",
      rootHref: "/admin",
      crumbSegments: segments,
      basePath: "/admin",
    };
  }
  if (pathname.startsWith("/hhdb")) {
    const segments = pathname
      .replace(/^\/hhdb\/?/, "")
      .split("/")
      .filter(Boolean);
    return {
      rootLabel: "HHDB",
      rootHref: "/hhdb",
      crumbSegments: segments,
      basePath: "/hhdb",
    };
  }
  if (pathname.startsWith("/docs")) {
    const segments = pathname
      .replace(/^\/docs\/?/, "")
      .split("/")
      .filter(Boolean);
    return {
      rootLabel: "Docs",
      rootHref: "/docs",
      crumbSegments: segments,
      basePath: "/docs",
    };
  }

  // Default: /udaman/[universe]/...
  const segments = pathname
    .replace(/^\/udaman\/?/, "")
    .split("/")
    .filter(Boolean);
  const universe = segments[0];
  return {
    rootLabel: "UDAMAN",
    rootHref: `/udaman/${universe}`,
    crumbSegments: segments.slice(1),
    basePath: `/udaman/${universe}`,
  };
}

export function NavBreadcrumb() {
  const pathname = usePathname();
  const { rootLabel, rootHref, crumbSegments, basePath } =
    parsePathname(pathname);

  if (crumbSegments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{rootLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const crumbs = crumbSegments.map((segment, i) => ({
    label: segmentLabels[segment] ?? formatSegment(segment),
    href: `${basePath}/${crumbSegments.slice(0, i + 1).join("/")}`,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href={rootHref}>{rootLabel}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem
                className={!isLast ? "hidden md:block" : undefined}
              >
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
