"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { translateHashUrl } from "../lib/links";

/**
 * Old Angular links used hash routing: `https://data.uhero.hawaii.edu/#/series?id=1`
 * or `/nta/#/category?id=…`. The UHERO portal is served at the root, so the
 * first lands on the landing page as `/#/series?id=1` (browsers also keep the
 * fragment across the `/data/uhero` → `/data` redirect). This translates it
 * to `/data/series?id=1` (`/data/nta/category?…` for NTA) once, client-side.
 */
export function HashRedirect({ universe }: { universe: string }) {
  const router = useRouter();
  useEffect(() => {
    const check = () => {
      const target = translateHashUrl(universe, window.location.hash);
      if (target) router.replace(target);
    };
    check();
    // Also catch an old link pasted into the address bar on an open page
    // (only the fragment changes → no reload).
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [universe, router]);
  return null;
}
