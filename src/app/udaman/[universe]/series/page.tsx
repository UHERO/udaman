import { Universe } from "@catalog/types/shared";
import { ClipboardCopy, ClipboardPlus } from "lucide-react";
import Link from "next/link";

import { getSeries, searchSeriesAction } from "@/actions/series-actions";
import { SeriesListTable } from "@/components/series/series-list-table";
import { H1 } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ universe: Universe }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { universe } = await params;
  const { q } = await searchParams;
  const data = q
    ? await searchSeriesAction(q, universe)
    : await getSeries({ universe });
  const count = data.length ?? 0;
  const isSearch = Boolean(q);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <SeriesCard count={count} isSearch={isSearch} />
        <CalculateCard />
        <TroubleCard />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesListTable data={data} />
      </div>
    </div>
  );
}

const SeriesCard = ({ count, isSearch }: { count: number; isSearch: boolean }) => (
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

const TroubleCard = () => (
  <div className="grid grid-rows-3 rounded-xl">
    <Button asChild className="max-w-80 justify-between" variant={"secondary"}>
      <Link href="#">
        Missing Source <Badge>+20</Badge>
      </Link>
    </Button>
    <Button asChild className="max-w-80 justify-between" variant={"secondary"}>
      <Link href="#">
        Quarantined <Badge>+20</Badge>
      </Link>
    </Button>
    <CalculateInput />
  </div>
);

const CalculateCard = () => <div className="grid grid-rows-3 rounded-xl"></div>;

const CalculateInput = () => (
  <div className="row-3 flex flex-col">
    <Label className="">Calculate</Label>
    <div className="flex flex-row">
      <Input className="max-w-64 rounded-r-none" />
      <Button
        variant={"secondary"}
        className="rounded-l-none border border-l-0"
      >
        Show
      </Button>
    </div>
  </div>
);
