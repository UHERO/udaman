import type { Universe } from "@catalog/types/shared";

import { getCategories } from "@/actions/categories";
import { getDataListsForCategoryTree } from "@/actions/data-lists";
import { getGeographies } from "@/actions/geographies";
import { Categories } from "@/components/categories/categories-page";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const u = universe as Universe;
  const [data, geographies, dataLists] = await Promise.all([
    getCategories({ universe: u }),
    getGeographies({ universe: u }),
    getDataListsForCategoryTree({ universe: u }),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Categories</h1>
      <p className="text-muted-foreground text-sm">
        Manage category definitions for the data portal.
      </p>
      <div className="mt-4">
        <Categories
          data={data}
          universe={u}
          geographies={geographies}
          dataLists={dataLists}
        />
      </div>
    </div>
  );
}
