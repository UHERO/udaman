"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  GitCompareArrows,
  LineChart,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WIDTH_STORAGE_KEY = "analyze-full-width";

const TABS = [
  { label: "Analyze", icon: LineChart, segment: "analyze" },
  { label: "Compare", icon: GitCompareArrows, segment: "compare" },
  { label: "Calculate", icon: Calculator, segment: "calculate" },
] as const;

interface AnalyzeTabsProps {
  /** Numeric id of the first/current series (from Analyze page) */
  firstSeriesId?: number | null;
  /** Name of the first series (from Analyze or Compare page) */
  firstSeriesName?: string | null;
  /** Whether the current page has active params worth resetting */
  hasParams?: boolean;
}

export function AnalyzeTabs({
  firstSeriesId,
  firstSeriesName,
  hasParams,
}: AnalyzeTabsProps) {
  const { universe } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const activeSegment = pathname.split("/").pop();

  // ── Width toggle (moved from AnalyzeLayout) ──────────────────────────
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(WIDTH_STORAGE_KEY) === "true");
  }, []);

  const toggleWidth = () => {
    const next = !fullWidth;
    setFullWidth(next);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    // Dispatch storage event so AnalyzeLayout picks up the change
    window.dispatchEvent(new Event("analyze-width-change"));
  };

  // ── Build cross-tab hrefs that preserve the first series ─────────────
  function hrefForTab(segment: string): string {
    const base = `/udaman/${universe}/series/${segment}`;

    // If going to the same tab, just return the base (no params = landing)
    if (segment === activeSegment) return base;

    if (segment === "analyze" && firstSeriesId) {
      return `${base}?id=${firstSeriesId}`;
    }
    if (segment === "compare" && firstSeriesName) {
      return `${base}?names=${encodeURIComponent(firstSeriesName)}`;
    }
    if (segment === "calculate" && firstSeriesName) {
      return `${base}?eval=${encodeURIComponent(firstSeriesName)}`;
    }

    return base;
  }

  const handleReset = () => {
    router.push(`/udaman/${universe}/series/${activeSegment}`);
  };

  return (
    <div className="flex items-center gap-1 border-b">
      {TABS.map((tab) => {
        const isActive = activeSegment === tab.segment;
        return (
          <Link
            key={tab.segment}
            href={hrefForTab(tab.segment)}
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
        {hasParams && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleReset}
            title="Reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
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
