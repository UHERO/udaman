import type { Metadata } from "next";

import { searchMetadata, SearchPage } from "../../views/search-page";

/** /data/<universe>/search — thin wrapper; body in views/search-page.tsx. */
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
  return searchMetadata(universe, await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  const { universe } = await params;
  return <SearchPage universe={universe} searchParams={await searchParams} />;
}
