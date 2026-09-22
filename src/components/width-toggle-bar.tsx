"use client";

import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";

export function WidthToggleBar() {
  const { fullWidth, toggleWidth } = useFullWidth();

  return (
    <div className="flex items-center justify-end border-b px-1">
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
  );
}
