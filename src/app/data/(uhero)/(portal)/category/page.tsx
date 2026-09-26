import type { Metadata } from "next";

import {
  landingMetadata,
  LandingPage,
} from "../../../[universe]/views/landing-page";

/** /data/category — UHERO at the portal root; body in [universe]/views/landing-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  return landingMetadata("uhero", await searchParams);
}

export default async function Page({ searchParams }: Props) {
  return <LandingPage universe="uhero" searchParams={await searchParams} />;
}
