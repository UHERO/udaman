"use client";

import { createContext, useContext } from "react";

import type { PortalConfig } from "./config";
import type { PortalCategories } from "./types";

interface PortalContextValue {
  config: PortalConfig;
  /** Category tree loaded once in the layout (server-side). */
  categories: PortalCategories;
}

const PortalContext = createContext<PortalContextValue | null>(null);

/**
 * Provided by src/app/data/[universe]/layout.tsx. Everything inside the
 * portal can read the universe config + category tree without refetching.
 */
export function PortalConfigProvider({
  config,
  categories,
  children,
}: PortalContextValue & { children: React.ReactNode }) {
  return (
    <PortalContext.Provider value={{ config, categories }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortalConfig(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error(
      "usePortalConfig must be used inside <PortalConfigProvider> (data/[universe]/layout.tsx)",
    );
  }
  return ctx;
}
