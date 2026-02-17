"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "series-full-width";

export function SeriesLayout({ children }: { children: React.ReactNode }) {
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");

    const handleChange = () => {
      setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");
    };
    window.addEventListener("series-width-change", handleChange);
    return () => window.removeEventListener("series-width-change", handleChange);
  }, []);

  return (
    <main className={cn("space-y-6", !fullWidth && "max-w-5xl")}>
      {children}
    </main>
  );
}
