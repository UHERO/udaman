import { hicentralAdapter } from "./sites/hicentral";
import { hresAdapter } from "./sites/hres";
import type { SiteAdapter } from "./types";

/** Every site the MLS pipeline can scrape. Adding a site = one line here. */
export const MLS_SITES: Record<string, SiteAdapter> = {
  [hicentralAdapter.site]: hicentralAdapter,
  [hresAdapter.site]: hresAdapter,
};

export function getSiteAdapter(site: string): SiteAdapter {
  const adapter = MLS_SITES[site];
  if (!adapter) {
    throw new Error(
      `Unknown MLS site "${site}" (known: ${Object.keys(MLS_SITES).join(", ")})`,
    );
  }
  return adapter;
}
