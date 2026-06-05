"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SummaryViewType } from "@catalog/types/hhdb";
import { getFieldsForViewType } from "@catalog/types/hhdb-data-dictionary";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

const VIEW_TABS: {
  label: string;
  segment: string;
  viewType: SummaryViewType;
}[] = [{ label: "Summary", segment: "summary", viewType: "summary" }];

interface HhdbTableLayoutProps {
  title: string;
  segment: string;
  fieldsTable: string | null;
  exploration?: boolean;
  rowCount?: number | null;
  children: React.ReactNode;
  warningBanner?: React.ReactNode;
}

export function HhdbTableLayout({
  title,
  segment,
  fieldsTable,
  exploration,
  rowCount,
  children,
  warningBanner,
}: HhdbTableLayoutProps) {
  const pathname = usePathname();
  const basePath = `/hhdb/tables/${segment}`;
  // Extract field from URL: /hhdb/tables/{segment}/{view}/{field}
  const segments = pathname.split("/");
  const fieldIdx = segments.indexOf(segment);
  const field = fieldIdx >= 0 && segments.length > fieldIdx + 3 ? segments[fieldIdx + 3] : undefined;
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

  const explorationTab = exploration
    ? [{ label: "Exploration", href: `${basePath}/exploration` }]
    : [];

  const tabs = [{ label: "Table", href: basePath }, ...viewTabs, ...explorationTab];

  // All non-Table tab hrefs for checking if Table tab should be active
  const nonTableHrefs = [...viewTabs, ...explorationTab].map((t) => t.href);

  const { fullWidth, toggleWidth } = useFullWidth();

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
      {warningBanner}
      <div className="mb-4 flex items-center border-b">
        <div className="flex min-w-0 flex-1 gap-1">
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
        <div className="flex shrink-0 items-center px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleWidth}
            title={fullWidth ? "Constrain width" : "Full width"}
          >
            {fullWidth ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
