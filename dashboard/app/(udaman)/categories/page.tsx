import { Universe } from "@shared/types/shared";
import { getCategories } from "actions/categories";
import { getGeographies } from "actions/geographies";

import { Categories } from "@/components/categories/categories-page";

export default async function Page({
  searchParams,
}: {
  searchParams: { u: Universe | undefined };
}) {
  const { u } = await searchParams;
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
