"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "analyze-full-width";

export function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const toggle = () => {
    const next = !fullWidth;
    setFullWidth(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <main className={cn("m-4 space-y-6", !fullWidth && "max-w-5xl")}>
      <div className="flex items-center justify-between">
        <div /> {/* spacer so toggle stays right-aligned */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggle}
          title={fullWidth ? "Constrain width" : "Full width"}
        >
          {fullWidth ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      {children}
    </main>
  );
}
