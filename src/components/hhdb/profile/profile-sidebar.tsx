"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import type { FieldCategory } from "@catalog/types/hhdb";
import { cn } from "@/lib/utils";

const CATEGORY_DOTS: Record<string, string> = {
  identifier: "bg-blue-500",
  "low-cardinality": "bg-green-500",
  "high-cardinality": "bg-yellow-500",
  "large-dollar": "bg-purple-500",
  "small-dollar": "bg-purple-500",
  year: "bg-orange-500",
  area: "bg-teal-500",
  count: "bg-cyan-500",
  date: "bg-rose-500",
  blob: "bg-gray-400",
};

export interface SidebarField {
  columnName: string;
  label: string;
  fieldCategory: FieldCategory;
}

interface ProfileSidebarProps {
  fields: SidebarField[];
  basePath: string;
}

export function ProfileSidebar({ fields, basePath }: ProfileSidebarProps) {
  const params = useParams();
  const selectedField =
    typeof params.field === "string" ? params.field : undefined;

  return (
    <div className="w-52 shrink-0">
      <Link
        href={basePath}
        className={cn(
          "mb-2 block text-xs font-medium tracking-wide uppercase transition-colors",
          selectedField
            ? "text-muted-foreground hover:text-foreground"
            : "text-primary",
        )}
      >
        All Fields
      </Link>
      <div className="max-h-[600px] space-y-0.5 overflow-y-auto">
        {fields.map((f) => {
          const isSelected = selectedField === f.columnName;
          return (
            <Link
              key={f.columnName}
              href={`${basePath}/${f.columnName}`}
              className={cn(
                "flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  CATEGORY_DOTS[f.fieldCategory] ?? "bg-gray-400",
                )}
              />
              {f.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
