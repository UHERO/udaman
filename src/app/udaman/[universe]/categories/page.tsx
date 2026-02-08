import { Universe } from "@catalog/types/shared";

import { getCategories } from "@/actions/categories";
import { getGeographies } from "@/actions/geographies";
import { Categories } from "@/components/categories/categories-page";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: Universe }>;
}) {
  const { universe } = await params;
  const [data, geographies] = await Promise.all([
    getCategories({ universe }),
    getGeographies({ universe }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Categories data={data} universe={universe} geographies={geographies} />
    </div>
  );
}
