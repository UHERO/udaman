import type { Metadata } from "next";

import { seriesMetadata, SeriesPage } from "../../views/series-page";

/** /data/<universe>/series — thin wrapper; body in views/series-page.tsx. */
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
  return seriesMetadata(universe, await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  const { universe } = await params;
  return <SeriesPage universe={universe} searchParams={await searchParams} />;
}
