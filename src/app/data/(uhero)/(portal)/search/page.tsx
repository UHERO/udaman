import type { Metadata } from "next";

import {
  searchMetadata,
  SearchPage,
} from "../../../[universe]/views/search-page";

/** /data/search — UHERO at the portal root; body in [universe]/views/search-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  return searchMetadata("uhero", await searchParams);
}

export default async function Page({ searchParams }: Props) {
  return <SearchPage universe="uhero" searchParams={await searchParams} />;
}
