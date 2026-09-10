"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Camera, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Snapshots", icon: Camera, segment: "snapshots" },
] as const;

export function ForecastTabs() {
  const { universe } = useParams();
  const pathname = useAppPathname();
  const base = `/udaman/${universe}/forecast`;

  const { fullWidth, toggleWidth } = useFullWidth();

  return (
    <div className="flex items-center border-b">
      {/* Scrolls sideways rather than overflowing the page on a narrow screen. */}
      <div className="flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const href = `${base}/${tab.segment}`;
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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

      <div className="flex shrink-0 items-center gap-1">
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
