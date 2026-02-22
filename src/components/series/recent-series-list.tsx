"use client";

import { useParams, useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import type { RecentSeriesEntry } from "@/hooks/use-recent-series";
import { useRecentSeries } from "@/hooks/use-recent-series";

type Mode = "analyze" | "compare" | "calculate";

interface RecentSeriesListProps {
  /** Which tab this is rendered in — determines how clicking navigates */
  mode: Mode;
  /** For compare mode: names already in the query */
  currentNames?: string[];
  /** Render as compact pills instead of cards */
  compact?: boolean;
}

export function RecentSeriesList({
  mode,
  currentNames = [],
  compact,
}: RecentSeriesListProps) {
  const { entries } = useRecentSeries();
  const { universe } = useParams();
  const router = useRouter();

  if (entries.length === 0) return null;

  const handleClick = (entry: RecentSeriesEntry) => {
    const base = `/udaman/${universe}/series`;
    switch (mode) {
      case "analyze":
        router.push(`${base}/analyze?id=${entry.id}`);
        break;
      case "compare": {
        const updated = [...currentNames, entry.name].filter(Boolean);
        router.push(
          `${base}/compare?names=${encodeURIComponent(updated.join(","))}`,
        );
        break;
      }
      case "calculate":
        router.push(`${base}/calculate?eval=${encodeURIComponent(entry.name)}`);
        break;
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Clock className="h-3.5 w-3.5" />
        Recently Viewed
      </div>

      {compact ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleClick(entry)}
              className="hover:bg-accent hover:text-accent-foreground inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-xs transition-colors"
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleClick(entry)}
              className="hover:bg-accent flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors"
            >
              <span className="font-mono text-xs font-medium">
                {entry.name}
              </span>
              {entry.dataPortalName && (
                <span className="text-muted-foreground line-clamp-2 text-[11px] leading-tight">
                  {entry.dataPortalName}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
