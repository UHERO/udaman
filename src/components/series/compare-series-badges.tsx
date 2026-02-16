"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface CompareSeriesBadgesProps {
  names: string[];
  seriesLinks: Record<string, number>;
  universe: string;
}

export function CompareSeriesBadges({
  names,
  seriesLinks,
  universe,
}: CompareSeriesBadgesProps) {
  const router = useRouter();

  const handleRemove = (nameToRemove: string) => {
    const remaining = names.filter((n) => n !== nameToRemove);
    const expr = remaining.join(",");
    router.push(
      `/udaman/${universe}/series/compare?names=${encodeURIComponent(expr)}`,
    );
  };

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {names.map((name) => {
        const id = seriesLinks[name];
        return (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs"
          >
            {id ? (
              <a
                href={`/udaman/${universe}/series/${id}`}
                className="hover:underline"
              >
                {name}
              </a>
            ) : (
              name
            )}
            <button
              type="button"
              onClick={() => handleRemove(name)}
              className="text-muted-foreground hover:text-foreground -mr-0.5 rounded p-0.5"
              aria-label={`Remove ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
