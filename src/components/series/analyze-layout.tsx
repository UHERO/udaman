"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "analyze-full-width";

export function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  const [fullWidth, setFullWidth] = useState(false);

  useEffect(() => {
    setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");

    const handleChange = () => {
      setFullWidth(localStorage.getItem(STORAGE_KEY) === "true");
    };
    window.addEventListener("analyze-width-change", handleChange);
    return () => window.removeEventListener("analyze-width-change", handleChange);
  }, []);

  return (
    <main className={cn("m-4 space-y-6", !fullWidth && "max-w-5xl")}>
      {children}
    </main>
  );
}
