import { getSnapshotDataAction } from "@/actions/forecast-snapshots";

import { ForecastSnapshotCharts } from "@/components/forecast-snapshots/forecast-snapshot-charts";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string; id: string }>;
  searchParams: Promise<{ sample_from?: string; sample_to?: string }>;
}) {
  const { id } = await params;
  const { sample_from, sample_to } = await searchParams;
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
      {data.snapshot.comments && (
        <p className="text-muted-foreground mt-1 text-sm">
          {data.snapshot.comments}
        </p>
      )}

      <ForecastSnapshotCharts
        newForecast={data.newForecast}
        oldForecast={data.oldForecast}
        history={data.history}
        allDates={data.allDates}
        newForecastLabel={data.snapshot.newForecastTsdLabel ?? "New Forecast"}
        oldForecastLabel={data.snapshot.oldForecastTsdLabel ?? "Old Forecast"}
        historyLabel={data.snapshot.historyTsdLabel ?? "History"}
        initialFrom={sample_from}
        initialTo={sample_to}
        displayNames={data.displayNames}
        snapshotId={Number(id)}
        snapshotName={data.snapshot.name ?? ""}
      />
    </div>
  );
}
