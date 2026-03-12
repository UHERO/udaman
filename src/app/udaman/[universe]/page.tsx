import Link from "next/link";

import { getCurrentUserContext } from "@/lib/auth/dal";
import { getVisibleRoutes } from "@/lib/auth/route-access";

/** Supplementary descriptions for homepage cards (route-access only has labels). */
const CARD_DESCRIPTIONS: Record<string, string> = {
  "Time Series": "Browse, search, and manage time series data",
  Catalog: "View and edit the data portal catalog tree",
  "CSV-to-TSD": "Convert CSV files to TSD format",
  Downloads: "Manage and run data downloads",
  Exports: "Manage data export configurations",
  Investigations: "Investigate data quality issues",
  Docs: "View documentation and guides",
  "Forecast Snapshots": "View and compare published forecast snapshots",
  Uploads: "Upload economic and tourism data files",
  Settings: "Configure data portal settings",
};

const universeNames: Record<string, string> = {
  UHERO: "UHERO",
  NTA: "National Transfer Accounts",
  CCOM: "Chamber of Commerce",
  DBEDT: "DBEDT",
  FC: "Forecast",
  COH: "County of Hawaii",
};

function prefixUrl(url: string, universe: string): string {
  if (url.startsWith("/udaman/")) return url;
  if (url.startsWith("/")) return `/udaman/${universe}${url}`;
  return url;
}

export default async function UniversePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const key = universe.toUpperCase();
  const name = universeNames[key] ?? universe;

  const { role, universe: userUniverse } = await getCurrentUserContext();
  const routes = getVisibleRoutes(role, userUniverse);

  const cards = routes.map((entry) => ({
    title: entry.label,
    description: CARD_DESCRIPTIONS[entry.label] ?? "",
    href: prefixUrl(entry.path, universe),
    icon: entry.icon,
  }));

  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-3xl font-bold">{name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Select a section to get started.
      </p>

      {cards.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="border-border hover:border-primary/40 hover:bg-accent group flex flex-col gap-3 rounded-lg border p-6 transition-colors"
            >
              <div className="flex items-center gap-3">
                <card.icon className="text-muted-foreground group-hover:text-primary size-5 transition-colors" />
                <span className="font-semibold">{card.title}</span>
              </div>
              <p className="text-muted-foreground text-sm">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Your current role does not have access to any tools in this
            universe. Contact an administrator if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  );
}
