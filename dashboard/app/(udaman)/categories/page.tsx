import Link from "next/link";
import { Universe } from "@shared/types/shared";
import { getCategories } from "actions/categories";
import { getSeries } from "actions/series-actions";
import { ClipboardCopy, ClipboardPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoriesListTable } from "@/components/categories/categories-list-table";
import { SeriesListTable } from "@/components/series/series-list-table";
import { H1 } from "@/components/typography";

export default async function Page({
  searchParams,
}: {
  searchParams: { u: Universe | undefined };
}) {
  const { u } = await searchParams;
  const data = await getCategories({ universe: u });
  const count = data.length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">hello</div>
      <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <CategoriesListTable data={data} universe={u} />
      </div>
    </div>
  );
}
