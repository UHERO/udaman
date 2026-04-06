"use client";

import Link from "next/link";
import { useAppPathname } from "@/hooks/use-app-pathname";
import {
  Activity,
  Calendar,
  Globe,
  Maximize2,
  Minimize2,
  ScrollText,
  Shield,
  ToggleRight,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { getVisibleChildren } from "@/lib/auth/route-access";
import { cn } from "@/lib/utils";

const TABS: { label: string; icon: LucideIcon; segment: string }[] = [
  { label: "Permissions", icon: Shield, segment: "" },
  { label: "Feature Toggles", icon: ToggleRight, segment: "feature-toggles" },
  { label: "Workers", icon: Activity, segment: "workers" },
  { label: "Schedules", icon: Calendar, segment: "schedules" },
  { label: "Users", icon: Users, segment: "users" },
  { label: "Logs", icon: ScrollText, segment: "logs" },
  { label: "Crawlers", icon: Globe, segment: "crawlers" },
];

export function AdminTabs({
  role,
  universe,
}: {
  role: string;
  universe: string;
}) {
  const pathname = useAppPathname();
  const base = "/udaman/admin";

  const visibleChildren = getVisibleChildren(role, universe, "/udaman/admin");
  const visibleTabs = TABS.filter((tab) =>
    visibleChildren.some((child) =>
      tab.segment === ""
        ? child.path === "/udaman/admin"
        : child.path === `/udaman/admin/${tab.segment}`,
    ),
  );

  const { fullWidth, toggleWidth } = useFullWidth();

  return (
    <div className="flex items-center gap-1 border-b">
      {visibleTabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const isActive = tab.segment
          ? pathname.startsWith(`${base}/${tab.segment}`)
          : pathname === base;
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
