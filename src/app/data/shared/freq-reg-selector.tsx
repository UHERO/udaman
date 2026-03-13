"use client";

import { cn } from "@/lib/utils";

import { SelectedFreq, SelectedGeo } from "../dbedt/types";

export const areas: string[] = [
  "Hawaii County",
  "Honolulu County",
  "Maui County",
  "State of Hawaii",
  "Kauai County",
];

export const freqMap: Record<string, string> = {
  M: "Monthly",
  Q: "Quarterly",
  A: "Annually",
};

export default function FrequencyRegionSelector({
  data,
  handleFreq,
  type,
  selector,
}: {
  data: SelectedFreq[] | SelectedGeo[];
  handleFreq: (f: string | SelectedFreq | SelectedGeo) => void;
  type: string;
  selector: string;
}) {
  return (
    <div
      className={cn(
        data.length > 0
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none: opacity-50",
      )}
    >
      <p
        className={cn(
          type === "dvw" ? "text-dvw" : "text-zinc-800",
          "mb-1.5 ml-1 text-sm font-semibold",
        )}
      >
        {selector.toUpperCase()}
      </p>
      <div className="relative flex h-36 w-32 min-w-fit flex-col items-start rounded-md border pt-2 md:w-40">
        {data.length > 0
          ? data?.map((d, i) => (
              <button
                className={cn(
                  d.state === true
                    ? type === "dvw"
                      ? "bg-dvw font-semibold text-white"
                      : "bg-dbedt font-semibold"
                    : "text-zinc-500",
                  "w-full p-1 text-start text-xs hover:font-semibold active:scale-[1.02]",
                )}
                onClick={() => {
                  handleFreq(type === "dvw" ? d.id : d);
                }}
                key={`freq-${i}`}
              >
                {selector === "frequency" ? freqMap[d.id] : d.text}
              </button>
            ))
          : (selector === "frequency" ? Object.values(freqMap) : areas).map(
              (s) => (
                <p
                  className="w-full p-1 text-start text-xs text-zinc-500"
                  key={`mock-${s}`}
                >
                  {s}
                </p>
              ),
            )}
      </div>
    </div>
  );
}
