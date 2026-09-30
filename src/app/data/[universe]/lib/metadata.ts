/**
 * Next.js Metadata for the public portal. Universe-level defaults come from
 * `universeMetadata` (used by the universe layouts); pages add their title,
 * canonical URL and Open Graph url through `pageMetadata`.
 *
 * All URLs are absolute (built from config.exportLabels.publicUrl), so they
 * point at the public portal on every host. `metadataBase` is the public
 * origin and only matters for relative URLs Next generates itself.
 *
 * Layout metadata deliberately sets no `alternates.canonical`: children
 * inherit it, which would make every page claim the landing page as its
 * canonical URL.
 */
import type { Metadata } from "next";

import { getPortalConfig } from "./config";
import type { PortalConfig } from "./config";
import { publicPortalUrl } from "./links";
import type { HrefParams, PortalRoute } from "./links";

const DESCRIPTIONS: Record<string, string> = {
  uhero:
    "Economic data for Hawaii from the University of Hawaii Economic Research Organization (UHERO): browse, chart, compare and download indicators for the state and its counties.",
  nta: "National Transfer Accounts (NTA) data portal: age profiles of income, consumption, transfers and saving by country, with charts, tables and downloads.",
  ccom: "Chamber of Commerce Hawaii data portal: economic indicators for Hawaii to browse, chart, compare and download, built by UHERO.",
  fc: "UHERO forecast data portal: forecasts of Hawaii economic indicators to browse, chart, compare and download.",
};

/** Per-universe icons (files in public/data-portal/<u>/icons/, from the Angular PWA icons). */
const ICON_SETS: Record<string, { small: string; large: string; og: string }> =
  {
    uhero: {
      small: "/data-portal/uhero/icons/UHEROdata_x96.png",
      large: "/data-portal/uhero/icons/UHEROdata_x192.png",
      og: "/data-portal/uhero/icons/UHEROdata_x512.png",
    },
    nta: {
      small: "/data-portal/nta/icons/nta_x96.png",
      large: "/data-portal/nta/icons/nta_x192.png",
      og: "/data-portal/nta/icons/nta_x512.png",
    },
    ccom: {
      small: "/data-portal/ccom/icons/ccom_x96.png",
      large: "/data-portal/ccom/icons/ccom_x192.png",
      og: "/data-portal/ccom/icons/ccom_x512.png",
    },
  };

/** FC and unknown universes share the UHERO .data branding. */
function iconSet(universe: string) {
  return ICON_SETS[universe] ?? ICON_SETS.uhero;
}

function origin(config: PortalConfig): string {
  return new URL(config.exportLabels.publicUrl).origin;
}

export function portalDescription(
  config: PortalConfig,
  dbDescription?: string | null,
): string {
  return (
    DESCRIPTIONS[config.universe] ??
    (dbDescription?.trim() || `${config.title}: economic data from UHERO.`)
  );
}

/** Universe-level defaults for the portal layouts. */
export function universeMetadata(
  universe: string,
  dbDescription?: string | null,
): Metadata {
  const config = getPortalConfig(universe);
  const icons = iconSet(config.universe);
  const base = origin(config);
  const description = portalDescription(config, dbDescription);
  return {
    metadataBase: new URL(base),
    title: { default: config.title, template: `%s | ${config.title}` },
    description,
    applicationName: config.title,
    icons: {
      icon: [{ url: icons.small, type: "image/png", sizes: "96x96" }],
      apple: [{ url: icons.large, sizes: "192x192" }],
    },
    openGraph: {
      type: "website",
      siteName: config.title,
      title: config.title,
      description,
      url: config.exportLabels.publicUrl,
      images: [{ url: `${base}${icons.og}`, width: 512, height: 512 }],
    },
    twitter: { card: "summary" },
  };
}

/**
 * Page metadata: `title` (templated as "<title> | <portal title>" by the
 * layout), canonical URL and a matching Open Graph block. Open Graph is
 * replaced — not merged — per segment, so the site name/image are repeated.
 */
export function pageMetadata(
  universe: string,
  opts: {
    title?: string;
    description?: string;
    route: PortalRoute;
    params?: HrefParams;
    noindex?: boolean;
  },
): Metadata {
  const config = getPortalConfig(universe);
  const url = publicPortalUrl(
    config.exportLabels.publicUrl,
    opts.route,
    opts.params,
  );
  const icons = iconSet(config.universe);
  const fullTitle = opts.title
    ? `${opts.title} | ${config.title}`
    : config.title;
  const description = opts.description ?? portalDescription(config);
  return {
    ...(opts.title ? { title: opts.title } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: config.title,
      title: fullTitle,
      description,
      url,
      images: [
        { url: `${origin(config)}${icons.og}`, width: 512, height: 512 },
      ],
    },
    ...(opts.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
