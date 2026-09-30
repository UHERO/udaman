import type { Metadata } from "next";

import { analyzerMetadata, AnalyzerPage } from "../../views/analyzer-page";

/** /data/<universe>/analyzer — thin wrapper; body in views/analyzer-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { universe } = await params;
  return analyzerMetadata(universe);
}

export default async function Page({ params, searchParams }: Props) {
  const { universe } = await params;
  return <AnalyzerPage universe={universe} searchParams={await searchParams} />;
}
