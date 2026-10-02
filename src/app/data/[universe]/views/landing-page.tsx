import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { fetchPortalCategories } from "@/actions/data-portal/portal";

import { CategorySkeleton } from "../components/category/category-skeleton";
import { CategoryView } from "../components/category/category-view";
import { loadCategoryPage } from "../components/category/load-category";
import { PortalCard } from "../components/ui/portal-card";
import { resolveCategorySelection } from "../lib/category";
import { getPortalConfig } from "../lib/config";
import { portalHref } from "../lib/links";
import type { HrefParams } from "../lib/links";
import { pageMetadata } from "../lib/metadata";
import { parseCategoryParams } from "../lib/url-params";
import type { CategoryParams } from "../lib/url-params";
import type { PortalPageProps, PortalSearchParams } from "./types";

/**
 * Landing / category page ('' and 'category' routes in Angular).
 * OWNER: workstream A (landing-page, category-charts, category-table-view,
 * geo/freq/forecast/measurement selectors, date-slider).
 *
 * A numeric `id` is a category; a non-numeric `id` is an old search link —
 * redirect those to ./search (see docs/data-portal-port.md).
 */
export async function LandingPage({ universe, searchParams }: PortalPageProps) {
  const query = parseCategoryParams(searchParams);
  // Old links put search terms in `id` on /category: send them to /search.
  if (typeof query.id === "string") {
    redirect(portalHref(universe, "search", searchParams as HrefParams));
  }

  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryContent universe={universe} query={query} />
    </Suspense>
  );
}

/**
 * Title = the selected category (and data list); no id → portal default.
 * Canonical: `/category?id=&data_list_id=` (the landing page with an id is
 * the same page).
 */
export async function landingMetadata(
  universe: string,
  searchParams: PortalSearchParams,
): Promise<Metadata> {
  const query = parseCategoryParams(searchParams);
  if (typeof query.id !== "number") {
    return pageMetadata(universe, { route: "" });
  }
  let title: string | undefined;
  try {
    const config = getPortalConfig(universe);
    const { tree } = await fetchPortalCategories(universe, config.rootCategory);
    const sel = resolveCategorySelection(tree, query.id, query.data_list_id);
    if (sel) {
      title =
        sel.dataList.id === sel.category.id
          ? sel.category.name
          : `${sel.dataList.name} – ${sel.category.name}`;
    }
  } catch {
    /* category API down: fall back to the portal title */
  }
  return pageMetadata(universe, {
    title,
    route: "category",
    params: { id: query.id, data_list_id: query.data_list_id },
  });
}

async function CategoryContent({
  universe,
  query,
}: {
  universe: string;
  query: CategoryParams;
}) {
  const result = await loadCategoryPage(getPortalConfig(universe), query);
  if (result.status !== "ok") {
    return (
      <PortalCard className="px-4 py-8 text-center text-sm">
        <p
          className={
            result.status === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          {result.message}
        </p>
      </PortalCard>
    );
  }
  return <CategoryView data={result.data} />;
}
