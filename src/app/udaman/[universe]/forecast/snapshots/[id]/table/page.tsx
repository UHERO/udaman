import { getSnapshotDataAction } from "@/actions/forecast-snapshots";

import { ForecastSnapshotDataTable } from "@/components/forecast-snapshots/forecast-snapshot-data-table";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { id } = await params;
  const data = await getSnapshotDataAction(Number(id));

  return (
    <div className="flex flex-col gap-y-2">
      <h1 className="text-3xl font-bold">
        {data.snapshot.name}{" "}
        <span className="text-muted-foreground text-xl">
          {data.snapshot.version}
        </span>
      </h1>
      {data.snapshot.updatedAt && (
        <p className="text-muted-foreground text-xs">
          Last update: {new Date(data.snapshot.updatedAt).toLocaleDateString()}
        </p>
      )}
      <ForecastSnapshotDataTable
        newForecast={data.newForecast}
        oldForecast={data.oldForecast}
        history={data.history}
        allDates={data.allDates}
        displayNames={data.displayNames}
        seriesIds={data.seriesIds}
        snapshotId={Number(id)}
        snapshotName={data.snapshot.name ?? ""}
      />
    </div>
  );
}
