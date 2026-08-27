"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Maximize2, Minimize2, Table2 } from "lucide-react";
import { toast } from "sonner";

import { lookupSeriesIdByName } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

const tabClass = (isActive: boolean) =>
  cn(
    "inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
    isActive
      ? "border-primary text-primary"
      : "text-muted-foreground hover:text-foreground border-transparent",
  );

/** Extract the first quoted series name from the exprs URL param,
 *  e.g. exprs="VISUSNS@KAU.M".ts|"VISNS@HI.M".ts → VISUSNS@KAU.M */
function firstSeriesNameFromUrl(): string | null {
  const exprs = new URLSearchParams(window.location.search).get("exprs");
  if (!exprs) return null;
  for (const expr of exprs.split("|")) {
    const match = expr.match(/"([^"]+)"/);
    if (match) return match[1];
  }
  return null;
}

export function AnalyzerTabs() {
  const router = useRouter();
  const { universe } = useParams<{ universe: string }>();
  const [navigating, setNavigating] = useState(false);
  const { fullWidth, toggleWidth } = useFullWidth();

  async function handleSeriesView() {
    if (navigating) return;

    // Read the URL at click time — the Analyzer keeps ?exprs= in sync via
    // history.replaceState as series are added/removed.
    const name = firstSeriesNameFromUrl();
    if (!name) {
      toast.warning("No series loaded", {
        description: "Add a series to the analyzer first.",
      });
      return;
    }

    setNavigating(true);
    const result = await lookupSeriesIdByName(name);
    if ("error" in result) {
      setNavigating(false);
      toast.error("Could not open series page", { description: result.error });
      return;
    }
    router.push(`/udaman/${universe}/series/${result.id}`);
  }

  return (
    <div className="flex items-center gap-1 border-b">
      <span className={tabClass(true)}>
        <LineChart className="h-4 w-4" />
        Analyzer View
      </span>
      <button
        type="button"
        onClick={handleSeriesView}
        disabled={navigating}
        className={cn(tabClass(false), navigating && "opacity-50")}
      >
        <Table2 className="h-4 w-4" />
        Series View
      </button>

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
