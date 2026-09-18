"use client";

import { useEffect, useState } from "react";
import { universes as fallbackUniverses } from "@catalog/utils/validators";

import { getUniverses } from "@/actions/universes";

/** In-module cache shared across all hook instances on the page */
let cache: string[] | null = null;
let inFlight: Promise<string[]> | null = null;

async function fetchOnce(): Promise<string[]> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = getUniverses()
      .then((rows) => {
        cache = rows.map((u) => u.name);
        return cache;
      })
      .catch(() => fallbackUniverses as string[]);
  }
  return inFlight;
}

/**
 * Returns the list of universe names from the DB, fetched once per page.
 * Falls back to the static `validators.universes` list while loading or on
 * error so callers always have something to render.
 */
export function useUniverseNames(): string[] {
  const [names, setNames] = useState<string[]>(
    cache ?? (fallbackUniverses as string[]),
  );

  useEffect(() => {
    let cancelled = false;
    fetchOnce().then((rows) => {
      if (!cancelled) setNames(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return names;
}
