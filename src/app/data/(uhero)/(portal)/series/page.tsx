import type { Metadata } from "next";

import {
  seriesMetadata,
  SeriesPage,
} from "../../../[universe]/views/series-page";

/** /data/series — UHERO at the portal root; body in [universe]/views/series-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  return seriesMetadata("uhero", await searchParams);
}

export default async function Page({ searchParams }: Props) {
  return <SeriesPage universe="uhero" searchParams={await searchParams} />;
}
