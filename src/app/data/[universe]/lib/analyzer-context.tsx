"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { portalHref, routeFromPathname, serializeParams } from "./links";
import { parseIdList } from "./url-params";

/**
 * Analyzer selection — the set of series ids the user has starred
 * (Angular AnalyzerService.analyzerSeriesStore).
 *
 * Sources of truth, in order:
 *   1. `analyzerSeries` in the URL (on /analyzer, and share links) — when it
 *      changes, the selection follows it.
 *   2. sessionStorage (per universe) — survives reloads within a tab. The
 *      Angular app kept this only in memory.
 *
 * Mutations made while ON the analyzer route are written back to the URL
 * (router.replace, so the server page re-renders with the new ids); removed
 * ids are also stripped from chartSeries / yleft / yright / column / area /
 * chartYoy / chartYtd / chartMom / chartC5ma.
 *
 * The /graph (embed) route never reads or writes the selection.
 */
interface AnalyzerContextValue {
  ids: number[];
  count: number;
  has: (id: number) => boolean;
  add: (id: number) => void;
  remove: (id: number) => void;
  toggle: (id: number) => void;
  /** Replace the whole selection (e.g. analyzer frequency switch). */
  set: (ids: number[]) => void;
  clear: () => void;
  /** Link to the analyzer page for the current selection. */
  analyzerHref: string;
}

const AnalyzerContext = createContext<AnalyzerContextValue | null>(null);

const ID_LIST_PARAMS = [
  "chartSeries",
  "yleft",
  "yright",
  "column",
  "area",
  "chartYoy",
  "chartYtd",
  "chartMom",
  "chartC5ma",
];

const storageKey = (universe: string) => `data-portal:${universe}:analyzer`;

function readStored(universe: string): number[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(universe));
    return raw ? parseIdList(raw) : [];
  } catch {
    return [];
  }
}

function writeStored(universe: string, ids: number[]) {
  try {
    window.sessionStorage.setItem(storageKey(universe), ids.join("-"));
  } catch {
    /* storage unavailable (private mode etc.) — selection stays in memory */
  }
}

export function AnalyzerProvider({
  universe,
  children,
}: {
  universe: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const analyzerPath = portalHref(universe, "analyzer");
  // Route = last path segment on every URL shape (/data/analyzer,
  // /data/nta/analyzer, subdomain /analyzer).
  const route = routeFromPathname(pathname);
  const onAnalyzer = route === "analyzer";
  const onGraph = route === "graph";
  const urlValue = onGraph ? null : searchParams.get("analyzerSeries");

  const [ids, setIds] = useState<number[]>(() =>
    urlValue ? parseIdList(urlValue) : [],
  );
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  const [hydrated, setHydrated] = useState(false);

  // URL → state ("adjust state on prop change" pattern, no effect needed).
  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    if (urlValue) setIds(parseIdList(urlValue));
  }

  // sessionStorage → state, once after mount (storage is client-only).
  useEffect(() => {
    if (!urlValue) {
      const stored = readStored(universe);
      if (stored.length) setIds(stored);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [universe]);

  useEffect(() => {
    if (hydrated) writeStored(universe, ids);
  }, [universe, ids, hydrated]);

  const syncUrl = useCallback(
    (next: number[], removed: number[] = []) => {
      if (!onAnalyzer) return;
      if (!next.length) {
        router.replace(analyzerPath);
        return;
      }
      const params: Record<string, string> = {};
      searchParams.forEach((v, k) => (params[k] = v));
      params.analyzerSeries = next.join("-");
      if (removed.length) {
        for (const key of ID_LIST_PARAMS) {
          if (!params[key]) continue;
          const kept = parseIdList(params[key]).filter(
            (id) => !removed.includes(id),
          );
          if (kept.length) params[key] = kept.join("-");
          else delete params[key];
        }
      }
      router.replace(`${pathname}${serializeParams(params)}`, {
        scroll: false,
      });
    },
    [onAnalyzer, router, analyzerPath, searchParams, pathname],
  );

  const set = useCallback(
    (next: number[]) => {
      const unique = [...new Set(next)];
      const removed = ids.filter((id) => !unique.includes(id));
      setIds(unique);
      syncUrl(unique, removed);
    },
    [ids, syncUrl],
  );

  const add = useCallback(
    (id: number) => {
      if (!ids.includes(id)) set([...ids, id]);
    },
    [ids, set],
  );
  const remove = useCallback(
    (id: number) => set(ids.filter((x) => x !== id)),
    [ids, set],
  );
  const toggle = useCallback(
    (id: number) => (ids.includes(id) ? remove(id) : add(id)),
    [ids, add, remove],
  );
  const clear = useCallback(() => set([]), [set]);
  const has = useCallback((id: number) => ids.includes(id), [ids]);

  const value = useMemo<AnalyzerContextValue>(
    () => ({
      ids,
      count: ids.length,
      has,
      add,
      remove,
      toggle,
      set,
      clear,
      analyzerHref: portalHref(universe, "analyzer", {
        analyzerSeries: ids.length ? ids.join("-") : null,
      }),
    }),
    [ids, has, add, remove, toggle, set, clear, universe],
  );

  return (
    <AnalyzerContext.Provider value={value}>
      {children}
    </AnalyzerContext.Provider>
  );
}

export function useAnalyzer(): AnalyzerContextValue {
  const ctx = useContext(AnalyzerContext);
  if (!ctx) {
    throw new Error(
      "useAnalyzer must be used inside <AnalyzerProvider> (data/[universe]/layout.tsx)",
    );
  }
  return ctx;
}
