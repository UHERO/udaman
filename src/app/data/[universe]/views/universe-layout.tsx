import { cache, Suspense } from "react";
import UniverseCollection from "@catalog/collections/universe-collection";
import { GoogleAnalytics } from "@next/third-parties/google";

import { fetchPortalCategories } from "@/actions/data-portal/portal";
import { getSession } from "@/lib/auth/dal";
import { normalizeUniverse } from "@/lib/auth/roles";

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
 * All universes from the DB `universe` table (deduped per request), or null
 * when the DB is unreachable — the public portal otherwise only needs the
 * REST API, so callers fall back to the config registry.
 */
const listUniverses = cache(async () => {
  try {
    return await UniverseCollection.list();
  } catch (e) {
    console.error("data portal: universe lookup failed, using registry", e);
    return null;
  }
});

/** Look up a universe by portal slug. */
export const lookupUniverse = cache(
  async (
    slug: string,
  ): Promise<{
    exists: boolean;
    description: string | null;
    internalOnly: boolean;
  }> => {
    const all = await listUniverses();
    if (!all) {
      return {
        exists: slug in PORTAL_CONFIGS,
        description: null,
        internalOnly: false,
      };
    }
    const row = all.find((u) => u.name.toLowerCase() === slug);
    return {
      exists: !!row,
      description: row?.description ?? null,
      internalOnly: row?.internalOnly ?? false,
    };
  },
);

/** Lowercase slugs of internal-only universes (hidden from the directory). */
async function internalUniverseSlugs(): Promise<string[]> {
  const all = await listUniverses();
  return (all ?? [])
    .filter((u) => u.internalOnly)
    .map((u) => u.name.toLowerCase());
}

/**
 * May the current visitor see an internal-only universe's portal? Requires a
 * udaman login; UHERO users see every universe, everyone else only their own
 * (the same cross-universe policy as src/proxy.ts).
 */
export async function canViewInternalPortal(slug: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const home = normalizeUniverse(session.user.universe ?? "UHERO");
  return (
    home === "UHERO" ||
    home === normalizeUniverse(getPortalConfig(slug).dbUniverse)
  );
}

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
  const internalUniverses = await internalUniverseSlugs();

  let categories: PortalCategories;
  try {
    categories = await fetchPortalCategories(universe, config.rootCategory);
  } catch (e) {
    console.error(`data portal: category fetch failed for ${universe}`, e);
    categories = { tree: [], rootId: null, flat: [] };
  }

  return (
    <PortalConfigProvider
      config={config}
      categories={categories}
      internalUniverses={internalUniverses}
    >
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
