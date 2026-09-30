import type { Metadata } from "next";

import { graphMetadata, GraphPage } from "../../[universe]/views/graph-page";

/** /data/graph — UHERO at the portal root; body in [universe]/views/graph-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return graphMetadata("uhero");
}

export default async function Page({ searchParams }: Props) {
  return <GraphPage universe="uhero" searchParams={await searchParams} />;
}
