"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Snapshots", icon: Camera, segment: "snapshots" },
] as const;

export function ForecastTabs() {
  const { universe } = useParams();
  const pathname = usePathname();
  const base = `/udaman/${universe}/forecast`;

  return (
    <div className="flex items-center gap-1 border-b">
      {TABS.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
