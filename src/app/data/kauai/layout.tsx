import type { Metadata } from "next";

import { KauaiHeader } from "./components/kauai-header";
import { KAUAI_CSS_VARS } from "./lib/theme";

export const metadata: Metadata = {
  title: {
    default: "Kauaʻi Economic Dashboard",
    template: "%s · Kauaʻi Economic Dashboard",
  },
  description:
    "Economic indicators for Kauaʻi County (jobs, visitors, income, construction, and the county budget) from the University of Hawaiʻi Economic Research Organization (UHERO).",
};

/** /data/kauai — custom dashboard (static segment; shadows [universe]). */
export default function KauaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="data-portal text-foreground flex min-h-svh flex-col bg-neutral-100"
      style={KAUAI_CSS_VARS}
    >
      <KauaiHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
