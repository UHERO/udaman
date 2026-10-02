import { cache, Suspense } from "react";
import UniverseCollection from "@catalog/collections/universe-collection";
import { GoogleAnalytics } from "@next/third-parties/google";

import { fetchPortalCategories } from "@/actions/data-portal/portal";

import { HashRedirect } from "../components/hash-redirect";
import { portalCssVars } from "../components/ui/chart-theme";
import { AnalyzerProvider } from "../lib/analyzer-context";
import { getPortalConfig, PORTAL_CONFIGS } from "../lib/config";
import { universeMetadata } from "../lib/metadata";
import { PortalConfigProvider } from "../lib/portal-context";
import type { PortalCategories } from "../lib/types";

/**
 * Shared body of the universe layouts:
 *   src/app/data/[universe]/layout.tsx  → /data/nta, /data/ccom, /data/fc, …
 *   src/app/data/(uhero)/layout.tsx     → /data (UHERO at the portal root)
 * Providers + GA + wrapper only; the header/sidebar chrome is in
 * views/portal-chrome.tsx so the /graph embed renders bare.
 */

/**
 * Look up a universe in the DB `universe` table (deduped per request). If
 * the DB is unreachable (the public portal otherwise only needs the REST
 * API), fall back to the config registry so the portal stays up.
 */
export const lookupUniverse = cache(
  async (
    slug: string,
  ): Promise<{ exists: boolean; description: string | null }> => {
    try {
      const all = await UniverseCollection.list();
      const row = all.find((u) => u.name.toLowerCase() === slug);
      return { exists: !!row, description: row?.description ?? null };
    } catch (e) {
      console.error("data portal: universe lookup failed, using registry", e);
      return { exists: slug in PORTAL_CONFIGS, description: null };
    }
  },
);

export async function universeLayoutMetadata(slug: string) {
  const { description } =
    slug in PORTAL_CONFIGS ? { description: null } : await lookupUniverse(slug);
  return universeMetadata(slug, description);
}

export async function UniverseLayout({
  universe,
  children,
}: {
  /** Canonical, validated universe slug. */
  universe: string;
  children: React.ReactNode;
}) {
  const config = getPortalConfig(universe);

  let categories: PortalCategories;
  try {
    categories = await fetchPortalCategories(universe, config.rootCategory);
  } catch (e) {
    console.error(`data portal: category fetch failed for ${universe}`, e);
    categories = { tree: [], rootId: null, flat: [] };
  }

  return (
    <PortalConfigProvider config={config} categories={categories}>
      <Suspense>
        <AnalyzerProvider universe={universe}>
          <HashRedirect universe={universe} />
          <div
            className="data-portal text-foreground flex min-h-svh flex-col bg-neutral-100"
            data-universe={config.dbUniverse}
            style={portalCssVars(config)}
          >
            {children}
          </div>
        </AnalyzerProvider>
      </Suspense>
      {/* GA4 for this universe only (production builds). Client-side
          navigations are counted by GA4 enhanced measurement ("page changes
          based on browser history events"); /graph embeds report too, as the
          Angular SPA did. */}
      {config.googleAnalyticsId && process.env.NODE_ENV === "production" && (
        <GoogleAnalytics gaId={config.googleAnalyticsId} />
      )}
    </PortalConfigProvider>
  );
}
