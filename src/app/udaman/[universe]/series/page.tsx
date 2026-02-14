import Link from "next/link";
import {
  getSeries,
  searchSeriesAction,
  getSeriesWithNullField,
  getQuarantinedSeries,
} from "@/actions/series-actions";
import type { Universe } from "@catalog/types/shared";
import { ClipboardCopy, ClipboardPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeriesListTable } from "@/components/series/series-list-table";
import { CalculateForm } from "@/components/series/calculate-form";
import { H1 } from "@/components/typography";

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

  const [data, noSourceResult, quarantineResult] = await Promise.all([
    q ? searchSeriesAction(q, u) : getSeries({ universe: u }),
    getSeriesWithNullField(u, "source_id", 1, 1),
    getQuarantinedSeries(u, 1, 1),
  ]);

  const count = data.length ?? 0;
  const isSearch = Boolean(q);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <SeriesCard count={count} isSearch={isSearch} />
        <div className="flex items-end rounded-xl">
          <CalculateForm />
        </div>
        <TroubleCard
          universe={universe}
          noSourceCount={noSourceResult.totalCount}
          quarantineCount={quarantineResult.totalCount}
        />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesListTable data={data} />
      </div>
    </div>
  );
}

const SeriesCard = ({
  count,
  isSearch,
}: {
  count: number;
  isSearch: boolean;
}) => (
  <div className="flex flex-col rounded-xl">
    <div>
      <H1>Data Series</H1>
      <p className="font-mono text-4xl">
        {isSearch ? `Search: ${count} results` : `Total: ${count}`}
      </p>
    </div>
    <Button asChild className="justify-start" variant={"ghost"}>
      <Link href="#">
        <ClipboardPlus />
        Add to Clipboard
      </Link>
    </Button>
    <Button asChild className="justify-start" variant={"ghost"}>
      <Link href="#">
        <ClipboardCopy />
        Replace Clipboard
      </Link>
    </Button>
  </div>
);

const TroubleCard = ({
  universe,
  noSourceCount,
  quarantineCount,
}: {
  universe: string;
  noSourceCount: number;
  quarantineCount: number;
}) => (
  <div className="flex flex-col gap-2 rounded-xl">
    <Button asChild className="max-w-80 justify-between" variant={"secondary"}>
      <Link href={`/udaman/${universe}/series/no-source`}>
        Missing Source{" "}
        <Badge variant={noSourceCount > 0 ? "destructive" : "secondary"}>
          {noSourceCount}
        </Badge>
      </Link>
    </Button>
    <Button asChild className="max-w-80 justify-between" variant={"secondary"}>
      <Link href={`/udaman/${universe}/series/quarantine`}>
        Quarantined{" "}
        <Badge variant={quarantineCount > 0 ? "destructive" : "secondary"}>
          {quarantineCount}
        </Badge>
      </Link>
    </Button>
  </div>
);
