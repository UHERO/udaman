"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getFieldsForViewType } from "@catalog/types/hhdb-data-dictionary";
import type { SummaryViewType } from "@catalog/types/hhdb";

const VIEW_TABS: { label: string; segment: string; viewType: SummaryViewType }[] = [
  { label: "Summary", segment: "summary", viewType: "summary" },
  { label: "Rank", segment: "rank", viewType: "rank" },
  { label: "Range", segment: "range", viewType: "range" },
];

interface HhdbTableLayoutProps {
  title: string;
  segment: string;
  fieldsTable: string | null;
  children: React.ReactNode;
  warningBanner?: React.ReactNode;
}

export function HhdbTableLayout({
  title,
  segment,
  fieldsTable,
  children,
  warningBanner,
}: HhdbTableLayoutProps) {
  const { universe } = useParams();
  const pathname = usePathname();
  const basePath = `/udaman/${universe}/hhdb/tables/${segment}`;

  const viewTabs = VIEW_TABS
    .filter((vt) => fieldsTable && getFieldsForViewType(fieldsTable, vt.viewType)?.length)
    .map((vt) => ({ label: vt.label, href: `${basePath}/${vt.segment}` }));

  const tabs = [
    { label: "Data", href: basePath },
    ...viewTabs,
  ];

  // All non-Data tab hrefs for checking if Data tab should be active
  const nonDataHrefs = viewTabs.map((t) => t.href);

  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="mb-4" />
      {warningBanner}
      <div className="mb-4 flex gap-1 border-b">
        {tabs.map((tab) => {
          const isActive =
            tab.label === "Data"
              ? pathname === basePath ||
                (pathname.startsWith(basePath) && !nonDataHrefs.some((h) => pathname.startsWith(h)))
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
