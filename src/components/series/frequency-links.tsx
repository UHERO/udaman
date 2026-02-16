import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FREQ_LABELS: Record<string, string> = {
  A: "Annual",
  S: "Semi",
  Q: "Quarterly",
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
};

interface FrequencyLinksProps {
  universe: string;
  currentFreqCode: string | null;
  siblings: Array<{ freqCode: string; id: number; name: string }>;
}

export function FrequencyLinks({
  universe,
  currentFreqCode,
  siblings,
}: FrequencyLinksProps) {
  if (siblings.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">Frequencies:</span>
      {siblings.map((s) => {
        const isCurrent = s.freqCode === currentFreqCode;
        const label = FREQ_LABELS[s.freqCode] ?? s.freqCode;
        if (isCurrent) {
          return (
            <Badge key={s.freqCode} variant="default" className="text-xs">
              {label}
            </Badge>
          );
        }
        return (
          <Link
            key={s.freqCode}
            href={`/udaman/${universe}/series/analyze?id=${s.id}`}
          >
            <Badge
              variant="outline"
              className={cn(
                "hover:bg-accent cursor-pointer text-xs transition-colors",
              )}
            >
              {label}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
