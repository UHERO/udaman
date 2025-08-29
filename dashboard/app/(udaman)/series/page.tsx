import { notFound } from "next/navigation";
import { getSeries } from "actions/series-actions";

import { SeriesSummaryTable } from "@/components/series/series-summary-table";

export default async function Page() {
  const { error, data } = await getSeries();
  if (error) throw error;
  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
        <div className="bg-muted/50 aspect-video rounded-xl" />
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesSummaryTable data={data} />
      </div>
    </div>
  );
}
