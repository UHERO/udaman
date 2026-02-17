"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AlertTriangle,
  Calculator,
  ClipboardList,
  GitCompareArrows,
  LineChart,
  List,
  Maximize2,
  Minimize2,
  SearchX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WIDTH_STORAGE_KEY = "series-full-width";

const TABS: {
  label: string;
  icon: LucideIcon;
  segment: string;
  badgeKey?: "noSource" | "quarantine";
}[] = [
  { label: "List", icon: List, segment: "" },
  { label: "Analyze", icon: LineChart, segment: "analyze" },
  { label: "Compare", icon: GitCompareArrows, segment: "compare" },
  { label: "Calculate", icon: Calculator, segment: "calculate" },
  { label: "Clipboard", icon: ClipboardList, segment: "clipboard" },
  { label: "Missing Metadata", icon: SearchX, segment: "no-source", badgeKey: "noSource" },
  { label: "Quarantine", icon: AlertTriangle, segment: "quarantine", badgeKey: "quarantine" },
];

interface SeriesTabsProps {
  badgeCounts?: {
    noSource: number;
    quarantine: number;
  };
}

export function SeriesTabs({ badgeCounts }: SeriesTabsProps) {
  const { universe } = useParams();
  const pathname = usePathname();
  const base = `/udaman/${universe}/series`;

  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(WIDTH_STORAGE_KEY) === "true");
  }, []);

  const toggleWidth = () => {
    const next = !fullWidth;
    setFullWidth(next);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event("series-width-change"));
  };

  return (
    <div className="flex items-center gap-1 border-b">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const isActive = tab.segment
          ? pathname.startsWith(`${base}/${tab.segment}`)
          : pathname === base;
        const badgeCount = tab.badgeKey && badgeCounts ? badgeCounts[tab.badgeKey] : undefined;
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
            {badgeCount !== undefined && badgeCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {badgeCount}
              </Badge>
            )}
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
