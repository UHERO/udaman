"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowUpToLine,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Palmtree,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { getVisibleChildren } from "@/lib/auth/route-access";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Econ", icon: FileSpreadsheet, segment: "econ" },
  { label: "Tour", icon: Palmtree, segment: "tour" },
  { label: "Forecast", icon: ArrowUpToLine, segment: "forecast" },
] as const;

export function UploadTabs({
  role,
  universe: userUniverse,
}: {
  role: string;
  universe: string;
}) {
  const { universe } = useParams();
  const pathname = usePathname();
  const base = `/udaman/${universe}/uploads`;

  const visibleChildren = getVisibleChildren(role, userUniverse, "/uploads");
  const visibleTabs = TABS.filter((tab) =>
    visibleChildren.some((child) => child.path === `/uploads/${tab.segment}`),
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
