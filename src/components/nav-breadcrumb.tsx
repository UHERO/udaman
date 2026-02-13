"use client";

import Link from "next/link";
import { Fragment } from "react";
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
  categories: "Categories",
  geographies: "Geographies",
  "data-loaders": "Data Loaders",
  clipboard: "Clipboard",
  downloads: "Downloads",
  analyze: "Analyze",
  quarantine: "Quarantine",
  "forecast-upload": "Forecast Upload",
  new: "New",
  edit: "Edit",
  duplicate: "Duplicate",
  create: "Create",
};

export function NavBreadcrumb() {
  const pathname = usePathname();

  // Strip /udaman/[universe] prefix, split remaining segments
  const segments = pathname
    .replace(/^\/udaman\/?/, "")
    .split("/")
    .filter(Boolean);

  const universe = segments[0];
  // Everything after the universe becomes breadcrumb items
  const crumbSegments = segments.slice(1);

  if (crumbSegments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const crumbs = crumbSegments.map((segment, i) => ({
    label: segmentLabels[segment] ?? segment,
    href: `/udaman/${universe}/${crumbSegments.slice(0, i + 1).join("/")}`,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href={`/udaman/${universe}`}>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className={!isLast ? "hidden md:block" : undefined}>
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
