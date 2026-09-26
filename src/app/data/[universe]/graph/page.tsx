import type { Metadata } from "next";

import { graphMetadata, GraphPage } from "../views/graph-page";

/** /data/<universe>/graph — thin wrapper; body in views/graph-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { universe } = await params;
  return graphMetadata(universe);
}

export default async function Page({ params, searchParams }: Props) {
  const { universe } = await params;
  return <GraphPage universe={universe} searchParams={await searchParams} />;
}
