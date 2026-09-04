import Link from "next/link";

import { getCurrentUserContext } from "@/lib/auth/dal";
import { getVisibleRoutes } from "@/lib/auth/route-access";

/** Supplementary descriptions for homepage cards (route-access only has labels). */
const CARD_DESCRIPTIONS: Record<string, string> = {
  "Time Series": "Browse and manage time series data",
  "Data Portal Catalog": "View and edit the Data Portal catalog tree",
  "CSV-to-TSD": "Convert CSV files to TSD format",
  Downloads: "Manage and run data downloads",
  Exports: "Manage data export configurations",
  Investigations: "Investigate data quality issues",
  Docs: "View documentation and guides",
  "Forecast Snapshots": "View and compare published forecast snapshots",
  "Housing Database": "Browse the Hawaii housing database (qPublic, TG)",
  Comms: "File and review pre-release sign-off forms",
  Registry: "Catalog of upstream UHERO data sources",
  Admin: "System administration",
  Uploads: "Upload economic and tourism data files",
  Settings: "Configure data portal settings",
  Econ: "Upload DBEDT economic indicators (XLSX)",
  Tour: "Upload DBEDT tourism indicators (XLSX)",
  Forecast: "Upload forecast XLSX files",
  Factbook: "Upload Hawaii Housing Factbook XLSX files",
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

  // If the user has access to exactly one top-level entry that has children,
  // expand its children as the cards. This gives narrowly-scoped users
  // (e.g. DBEDT external uploaders) direct links to the pages they can use,
  // instead of a single parent card they have to click into.
  const cards =
    routes.length === 1 && routes[0].children?.length
      ? routes[0].children.map((child) => ({
          title: child.label,
          description: CARD_DESCRIPTIONS[child.label] ?? "",
          href: prefixUrl(child.path, universe),
          icon: routes[0].icon,
        }))
      : routes.map((entry) => ({
          title: entry.label,
          description: CARD_DESCRIPTIONS[entry.label] ?? "",
          // Rail apps (/hhdb, /comms, ...) live outside /udaman/{universe}.
          href:
            entry.location === "rail"
              ? entry.path
              : prefixUrl(entry.href ?? entry.path, universe),
          icon: entry.icon,
        }));

  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-3xl font-bold">{name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        UHERO Data Manager (UDAMAN) is a collection of data management tools.
        Select one to get started.
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
            Your account does not have access to any tools yet. New accounts
            start with limited permissions — contact a UDAMAN administrator to
            request access.
          </p>
        </div>
      )}
    </div>
  );
}
