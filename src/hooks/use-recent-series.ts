"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "recent-series";
const MAX_ENTRIES = 10;

export interface RecentSeriesEntry {
  id: number;
  name: string;
  universe: string;
  description?: string | null;
  dataPortalName?: string | null;
}

// ── In-memory snapshot + listeners for useSyncExternalStore ───────────

let snapshot: RecentSeriesEntry[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  snapshot = null; // invalidate cache
  listeners.forEach((l) => l());
}

function getSnapshot(): RecentSeriesEntry[] {
  if (snapshot === null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      snapshot = raw ? (JSON.parse(raw) as RecentSeriesEntry[]) : [];
    } catch {
      snapshot = [];
    }
  }
  return snapshot;
}

function getServerSnapshot(): RecentSeriesEntry[] {
  return [];
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Public push helper (also usable outside React) ───────────────────

export function pushRecentSeries(entry: RecentSeriesEntry) {
  const current = getSnapshot();
  const filtered = current.filter((e) => e.id !== entry.id);
  const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emit();
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useRecentSeries() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const push = useCallback((entry: RecentSeriesEntry) => {
    pushRecentSeries(entry);
  }, []);

  return { entries, push };
}
