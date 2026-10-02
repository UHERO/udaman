import type { Metadata } from "next";

import {
  UniverseLayout,
  universeLayoutMetadata,
} from "../[universe]/views/universe-layout";

/**
 * UHERO data portal at the portal root: /data, /data/category, /data/series,
 * /data/analyzer, /data/search, /data/graph (data.uhero.hawaii.edu/…).
 * Same shared views as src/app/data/[universe] (other universes), with the
 * universe fixed. These static segments shadow [universe] values of the same
 * name; /data/uhero/… redirects here (src/proxy.ts).
 */
export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return universeLayoutMetadata("uhero");
}

export default function UheroPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UniverseLayout universe="uhero">{children}</UniverseLayout>;
}
