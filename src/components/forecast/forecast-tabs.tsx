"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Camera, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WIDTH_STORAGE_KEY = "udaman-full-width";

const TABS = [
  { label: "Snapshots", icon: Camera, segment: "snapshots" },
] as const;

export function ForecastTabs() {
  const { universe } = useParams();
  const pathname = usePathname();
  const base = `/udaman/${universe}/forecast`;

  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(WIDTH_STORAGE_KEY) === "true");
  }, []);

  const toggleWidth = () => {
    const next = !fullWidth;
    setFullWidth(next);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event("udaman-width-change"));
  };

  return (
    <div className="flex items-center gap-1 border-b">
      {TABS.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const isActive = pathname.startsWith(href);
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
