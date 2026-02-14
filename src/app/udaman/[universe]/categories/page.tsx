import { getCategories } from "@/actions/categories";
import { getGeographies } from "@/actions/geographies";
import type { Universe } from "@catalog/types/shared";

import { Categories } from "@/components/categories/categories-page";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const u = universe as Universe;
  const [data, geographies] = await Promise.all([
    getCategories({ universe: u }),
    getGeographies({ universe: u }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Categories data={data} universe={u} geographies={geographies} />
    </div>
  );
}
