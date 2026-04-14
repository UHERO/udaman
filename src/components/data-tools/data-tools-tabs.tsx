"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, FileSpreadsheet, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { useFullWidth } from "@/hooks/use-full-width";
import { getVisibleChildren } from "@/lib/auth/route-access";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "TSD Tools", icon: FileSpreadsheet, segment: "tsd" },
  { label: "Timeline", icon: Calendar, segment: "timeline" },
] as const;

export function DataToolsTabs({
  role,
  universe: userUniverse,
}: {
  role: string;
  universe: string;
}) {
  const { universe } = useParams();
  const pathname = useAppPathname();
  const base = `/udaman/${universe}/data-tools`;

  const visibleChildren = getVisibleChildren(
    role,
    userUniverse,
    "/data-tools",
  );
  const visibleTabs = TABS.filter((tab) =>
    visibleChildren.some(
      (child) => child.path === `/data-tools/${tab.segment}`,
    ),
  );

  const { fullWidth, toggleWidth } = useFullWidth();

  return (
    <div className="flex items-center gap-1 border-b">
      {visibleTabs.map((tab) => {
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

      <div className="ml-auto flex items-center gap-1">
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
  );
}
