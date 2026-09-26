import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { canonicalUniverse } from "./lib/config";
import { portalHref, ROOT_UNIVERSE } from "./lib/links";
import {
  lookupUniverse,
  UniverseLayout,
  universeLayoutMetadata,
} from "./views/universe-layout";

/**
 * Public data portal for every universe except UHERO: /data/nta, /data/ccom,
 * /data/fc, … UHERO is served at the portal root by src/app/data/(uhero)
 * with the same shared views (views/*). Static siblings (/data/dvw,
 * /data/dbedt and UHERO's /data/category, /data/series, …) win over this
 * dynamic segment.
 *
 * OWNER: foundation. Thin wrapper: validation here, body in
 * views/universe-layout.tsx.
 */
export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: Promise<{ universe: string }>;
};

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { universe } = await params;
  return universeLayoutMetadata(canonicalUniverse(universe));
}

export default async function PortalLayout({ children, params }: Props) {
  const { universe: rawSlug } = await params;
  const slug = canonicalUniverse(rawSlug);
  // src/proxy.ts already redirects /data/uhero/… → /data/… and
  // /data/forecast/… → /data/fc/… keeping the path; these are fallbacks.
  if (slug === ROOT_UNIVERSE) permanentRedirect(portalHref(ROOT_UNIVERSE));
  if (slug !== rawSlug) redirect(portalHref(slug));
  if (!(await lookupUniverse(slug)).exists) notFound();

  return <UniverseLayout universe={slug}>{children}</UniverseLayout>;
}
