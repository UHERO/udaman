import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeries } from "actions/series-actions";
import { ClipboardCopy, ClipboardPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeriesSummaryTable } from "@/components/series/tables";
import { H1 } from "@/components/typography";

export default async function Page() {
  const { error, data } = await getSeries();
  if (error) throw error;
  if (!data) notFound();

  const count = data.length ?? 0;
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <SeriesCard count={count} />
        <CalculateCard />
        <TroubleCard />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesSummaryTable data={data} />
      </div>
    </div>
  );
}

const SeriesCard = ({ count }: { count: number }) => (
  <div className="flex flex-col rounded-xl">
    <div>
      <H1>Data Series</H1>
      <p className="font-mono text-4xl">Total: {count}</p>
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
