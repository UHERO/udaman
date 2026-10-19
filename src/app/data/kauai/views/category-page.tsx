import { notFound } from "next/navigation";

import { DashboardView } from "../components/dashboard-view";
import { KauaiFooter } from "../components/kauai-footer";
import { getCategory, resolveFreq } from "../lib/categories";
import { loadCategoryData } from "../lib/data";

/**
 * Shared body of /data/kauai (Major Indicators) and /data/kauai/<category>.
 * Data is fetched on the server for the requested frequency only; a freq
 * switch is a navigation (?freq=q), so the client never holds more than one.
 */
export async function KauaiCategoryPage({
  slug,
  freq: rawFreq,
}: {
  slug?: string;
  freq?: string;
}) {
  const category = getCategory(slug);
  if (!category) notFound();
  const freq = resolveFreq(category, rawFreq);
  const data = await loadCategoryData(category, freq);

  return (
    <>
      <DashboardView
        key={`${category.slug}-${freq}`}
        category={category}
        data={data}
      />
      <KauaiFooter category={category} />
    </>
  );
}

export function kauaiPageMetadata(slug?: string) {
  const category = getCategory(slug);
  return { title: category?.title ?? "Not found" };
}
