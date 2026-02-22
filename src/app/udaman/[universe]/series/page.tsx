import Link from "next/link";
import type { Universe } from "@catalog/types/shared";
import { ClipboardCopy, ClipboardPlus, Plus } from "lucide-react";

import { getSeries, searchSeriesAction } from "@/actions/series-actions";
import { CalculateForm } from "@/components/series/calculate-form";
import { SeriesListTable } from "@/components/series/series-list-table";
import { Button } from "@/components/ui/button";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { universe } = await params;
  const u = universe as Universe;
  const { q } = await searchParams;

  const data = await (q
    ? searchSeriesAction(q, u)
    : getSeries({ universe: u }));

  const count = data.length ?? 0;
  const isSearch = Boolean(q);

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Data Series</h1>
        <p className="text-muted-foreground text-sm">
          {isSearch ? `Search: ${count} results` : `${count} series`}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost">
            <Link href="#">
              <ClipboardPlus className="mr-2 h-4 w-4" />
              Add to Clipboard
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="#">
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Replace Clipboard
            </Link>
          </Button>
        </div>
        <CalculateForm />
        <Button className="cursor-pointer" asChild>
          <Link href={`/udaman/${universe}/series/create`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Series
          </Link>
        </Button>
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesListTable data={data} />
      </div>
    </>
  );
}
