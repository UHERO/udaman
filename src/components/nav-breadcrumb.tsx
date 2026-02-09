"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sectionLabels: Record<string, string> = {
  series: "Series",
  categories: "Categories",
  geographies: "Geographies",
  "data-loaders": "Data Loaders",
  clipboard: "Clipboard",
  downloads: "Downloads",
};

export function NavBreadcrumb() {
  const pathname = usePathname();

  // /udaman/[universe]/[section]/[id]/...
  const segments = pathname.replace(/^\/udaman\/?/, "").split("/").filter(Boolean);

  // segments[0] = universe, segments[1] = section, segments[2] = id, etc.
  const universe = segments[0];
  const section = segments[1];
  const itemId = segments[2];

  const sectionLabel = section ? sectionLabels[section] ?? section : null;
  const sectionHref = universe && section ? `/udaman/${universe}/${section}` : null;

  // On /udaman or /udaman/[universe] — just show Home
  if (!sectionLabel) {
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

  // On a section page like /udaman/UHERO/series
  if (!itemId) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink asChild>
              <Link href={`/udaman/${universe}`}>Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{sectionLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // On an item page like /udaman/UHERO/series/123
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href={`/udaman/${universe}`}>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link href={sectionHref!}>{sectionLabel}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{itemId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
