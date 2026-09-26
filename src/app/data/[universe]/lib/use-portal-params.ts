"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { portalHref, serializeParams } from "./links";
import type { HrefParams, PortalRoute } from "./links";
import { usePortalConfig } from "./portal-context";
import type { FreqCode } from "./types";
import {
  parseAnalyzerParams,
  parseCategoryParams,
  parseGraphParams,
  parseSeriesParams,
} from "./url-params";

export interface SetParamsOptions {
  /**
   * "replace" (default) → router.replace; "push" → router.push (adds a history
   * entry, like Angular router.navigate); "shallow" → window.history.
   * replaceState: updates the URL and useSearchParams WITHOUT re-running the
   * server page (use for start/end slider changes — Angular used
   * location.go for these).
   */
  mode?: "replace" | "push" | "shallow";
  /** Keep existing params (default true — Angular queryParamsHandling:'merge'). */
  merge?: boolean;
  scroll?: boolean;
}

/**
 * URL state for the portal. Wraps useSearchParams + router so components
 * read/write the same param names the Angular app used.
 *
 *   const { category, setParams } = usePortalParams();
 *   setParams({ view: "table" });                      // merge + replace
 *   setParams({ start, end }, { mode: "shallow" });    // no server refetch
 *   navigate("series", { id: 123 });                   // push to another route
 *
 * `null`/`undefined`/"" values delete a param.
 */
export function usePortalParams() {
  const { config } = usePortalConfig();
  const universe = config.universe;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const buildMerged = useCallback(
    (updates: HrefParams, merge = true) => {
      const next: HrefParams = {};
      if (merge) searchParams.forEach((v, k) => (next[k] = v));
      Object.assign(next, updates);
      return next;
    },
    [searchParams],
  );

  const setParams = useCallback(
    (updates: HrefParams, opts: SetParamsOptions = {}) => {
      const { mode = "replace", merge = true, scroll = false } = opts;
      const url = `${pathname}${serializeParams(buildMerged(updates, merge))}`;
      if (mode === "shallow") {
        window.history.replaceState(null, "", url);
      } else if (mode === "push") {
        router.push(url, { scroll });
      } else {
        router.replace(url, { scroll });
      }
    },
    [pathname, router, buildMerged],
  );

  /** Href to another portal route; merge=true carries current params over. */
  const href = useCallback(
    (route: PortalRoute, params: HrefParams = {}, merge = false) =>
      portalHref(universe, route, buildMerged(params, merge)),
    [universe, buildMerged],
  );

  const navigate = useCallback(
    (
      route: PortalRoute,
      params: HrefParams = {},
      opts: { merge?: boolean; replace?: boolean } = {},
    ) => {
      const url = href(route, params, opts.merge ?? false);
      if (opts.replace) router.replace(url);
      else router.push(url);
    },
    [href, router],
  );

  const category = useMemo(
    () => parseCategoryParams(searchParams),
    [searchParams],
  );
  const series = useMemo(() => parseSeriesParams(searchParams), [searchParams]);
  const analyzer = useMemo(
    () => parseAnalyzerParams(searchParams),
    [searchParams],
  );
  const graph = useMemo(() => parseGraphParams(searchParams), [searchParams]);

  return {
    universe,
    pathname,
    searchParams,
    /** Parsed views of the current query (pick the one for your page). */
    category,
    series,
    analyzer,
    graph,
    setParams,
    href,
    navigate,
  };
}

/**
 * Previous frequency across renders (Angular kept `previousFreq` so the date
 * slider can re-map the end date when switching A → Q, etc.). Returns the
 * freq that was current before the latest change, or null.
 *
 * Only meaningful while the component stays mounted (App Router keeps the
 * page mounted across search-param-only navigations).
 */
export function usePreviousFreq(freq: FreqCode | null | undefined) {
  const cur = freq ?? null;
  // "Storing information from previous renders" pattern (react.dev).
  const [state, setState] = useState<{
    current: FreqCode | null;
    previous: FreqCode | null;
  }>({ current: cur, previous: null });
  if (cur !== state.current) {
    setState({ current: cur, previous: state.current });
    return state.current;
  }
  return state.previous;
}
