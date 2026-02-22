"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Pin, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CompareFilterBuilder } from "./compare-filter-builder";
import type { BuilderHandle } from "./parse-filter-names";

interface CompareToolbarProps {
  initialMeasurements: {
    id: number;
    prefix: string;
    dataPortalName: string | null;
  }[];
  initialGeos: { handle: string; displayName: string | null }[];
  currentUniverse: string;
  currentFrequency: string;
  currentNames: string[];
}

export function CompareToolbar({
  initialMeasurements,
  initialGeos,
  currentUniverse,
  currentFrequency,
  currentNames,
}: CompareToolbarProps) {
  const router = useRouter();
  const { universe } = useParams();

  const [isPending, setIsPending] = useState(false);
  const [filledCount, setFilledCount] = useState(0);

  const builderRef = useRef<BuilderHandle>(null);

  const handleReset = () => {
    router.push(`/udaman/${universe}/series/compare`);
  };

  const handleCompare = async () => {
    if (!builderRef.current) return;
    setIsPending(true);
    try {
      await builderRef.current.submit();
    } catch {
      // Error already displayed by the builder
    } finally {
      setIsPending(false);
    }
  };

  const builderKey = currentNames.join(",");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled>
          <Pin className="h-3.5 w-3.5" />
          Pin
        </Button>
        {currentNames.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleCompare}
          disabled={isPending || filledCount === 0}
        >
          {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Compare
          {filledCount > 0 &&
            ` (${filledCount} ${filledCount === 1 ? "filter" : "filters"})`}
        </Button>
      </div>

      <CompareFilterBuilder
        key={builderKey}
        ref={builderRef}
        initialMeasurements={initialMeasurements}
        initialGeos={initialGeos}
        currentUniverse={currentUniverse}
        currentFrequency={currentFrequency}
        currentNames={currentNames}
        onFilledCountChange={setFilledCount}
      />
    </div>
  );
}
