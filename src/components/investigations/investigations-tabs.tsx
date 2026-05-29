"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, SearchX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { getVisibleChildren } from "@/lib/auth/route-access";
import { cn } from "@/lib/utils";

const TABS: {
  label: string;
  icon: LucideIcon;
  segment: string;
  badgeKey?: "noSource" | "quarantine";
}[] = [
  {
    label: "Missing Metadata",
    icon: SearchX,
    segment: "no-source",
    badgeKey: "noSource",
  },
  {
    label: "Quarantine",
    icon: AlertTriangle,
    segment: "quarantine",
    badgeKey: "quarantine",
  },
];

interface InvestigationsTabsProps {
  role: string;
  universe: string;
  badgeCounts?: {
    noSource: number;
    quarantine: number;
  };
}

export function InvestigationsTabs({
  role,
  universe: userUniverse,
  badgeCounts,
}: InvestigationsTabsProps) {
  const { universe } = useParams();
  const pathname = useAppPathname();
  const base = `/udaman/${universe}/investigations`;

  const visibleChildren = getVisibleChildren(
    role,
    userUniverse,
    "/investigations",
  );
  const visibleTabs = TABS.filter((tab) =>
    visibleChildren.some(
      (child) => child.path === `/investigations/${tab.segment}`,
    ),
  );

  return (
    <div className="flex items-center gap-1 border-b">
      {visibleTabs.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const isActive = pathname.startsWith(`${base}/${tab.segment}`);
        const badgeCount =
          tab.badgeKey && badgeCounts ? badgeCounts[tab.badgeKey] : undefined;
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
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {badgeCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
