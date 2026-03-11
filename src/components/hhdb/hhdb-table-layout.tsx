"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { SummaryViewType } from "@catalog/types/hhdb";
import { getFieldsForViewType } from "@catalog/types/hhdb-data-dictionary";

import { cn } from "@/lib/utils";

const VIEW_TABS: {
  label: string;
  segment: string;
  viewType: SummaryViewType;
}[] = [
  { label: "Summary", segment: "summary", viewType: "summary" },
  { label: "Rank", segment: "rank", viewType: "rank" },
  { label: "Range", segment: "range", viewType: "range" },
];

interface HhdbTableLayoutProps {
  title: string;
  segment: string;
  fieldsTable: string | null;
  rowCount?: number | null;
  children: React.ReactNode;
  warningBanner?: React.ReactNode;
}

export function HhdbTableLayout({
  title,
  segment,
  fieldsTable,
  rowCount,
  children,
  warningBanner,
}: HhdbTableLayoutProps) {
  const { universe, field } = useParams();
  const pathname = usePathname();
  const basePath = `/udaman/${universe}/hhdb/tables/${segment}`;
  const currentField = typeof field === "string" ? field : undefined;

  const viewTabs = VIEW_TABS.filter(
    (vt) =>
      fieldsTable && getFieldsForViewType(fieldsTable, vt.viewType)?.length,
  ).map((vt) => {
    const base = `${basePath}/${vt.segment}`;
    // Preserve selected field if it's valid for the target view type
    if (currentField && fieldsTable) {
      const fields = getFieldsForViewType(fieldsTable, vt.viewType);
      if (fields?.some((f) => f.key === currentField)) {
        return { label: vt.label, href: `${base}/${currentField}` };
      }
    }
    return { label: vt.label, href: base };
  });

  const tabs = [{ label: "Table", href: basePath }, ...viewTabs];

  // All non-Table tab hrefs for checking if Table tab should be active
  const nonTableHrefs = viewTabs.map((t) => t.href);

  return (
    <div>
      <h1 className="text-3xl font-bold">
        {title}
        {rowCount != null && (
          <span className="text-muted-foreground ml-3 text-lg font-normal">
            {rowCount.toLocaleString()} records
          </span>
        )}
      </h1>
      <div className="mb-4" />
      {warningBanner}
      <div className="mb-4 flex gap-1 border-b">
        {tabs.map((tab) => {
          const isActive =
            tab.label === "Table"
              ? pathname === basePath ||
                (pathname.startsWith(basePath) &&
                  !nonTableHrefs.some((h) => pathname.startsWith(h)))
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
