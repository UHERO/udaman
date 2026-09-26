import type { Metadata } from "next";

import { landingMetadata, LandingPage } from "../../views/landing-page";

/** /data/<universe>/category — thin wrapper; body in views/landing-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { universe } = await params;
  return landingMetadata(universe, await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  const { universe } = await params;
  return <LandingPage universe={universe} searchParams={await searchParams} />;
}
