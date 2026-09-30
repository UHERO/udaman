import type { Metadata } from "next";

import {
  analyzerMetadata,
  AnalyzerPage,
} from "../../../[universe]/views/analyzer-page";

/** /data/analyzer — UHERO at the portal root; body in [universe]/views/analyzer-page.tsx. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return analyzerMetadata("uhero");
}

export default async function Page({ searchParams }: Props) {
  return <AnalyzerPage universe="uhero" searchParams={await searchParams} />;
}
