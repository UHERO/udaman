import Link from "next/link";

import { getSnapshotDataAction } from "@/actions/forecast-snapshots";
import { ForecastSnapshotCharts } from "@/components/forecast-snapshots/forecast-snapshot-charts";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const data = await getSnapshotDataAction(Number(id));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {data.snapshot.name}{" "}
            <span className="text-muted-foreground text-xl">
              v{data.snapshot.version}
            </span>
          </h1>
          {data.snapshot.comments && (
            <p className="text-muted-foreground mt-1 text-sm">
              {data.snapshot.comments}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/udaman/${universe}/forecast/snapshots/${id}/table`}
            className="text-sm underline"
          >
            Table View
          </Link>
          <Link
            href={`/udaman/${universe}/forecast/snapshots/${id}/edit`}
            className="text-sm underline"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="text-muted-foreground mb-4 flex gap-6 text-sm">
        {data.snapshot.newForecastTsdLabel && (
          <span>New Forecast: {data.snapshot.newForecastTsdLabel}</span>
        )}
        {data.snapshot.oldForecastTsdLabel && (
          <span>Old Forecast: {data.snapshot.oldForecastTsdLabel}</span>
        )}
        {data.snapshot.historyTsdLabel && (
          <span>History: {data.snapshot.historyTsdLabel}</span>
        )}
      </div>

      <ForecastSnapshotCharts
        newForecast={data.newForecast}
        oldForecast={data.oldForecast}
        history={data.history}
        allDates={data.allDates}
        newForecastLabel={data.snapshot.newForecastTsdLabel ?? "New Forecast"}
        oldForecastLabel={data.snapshot.oldForecastTsdLabel ?? "Old Forecast"}
        historyLabel={data.snapshot.historyTsdLabel ?? "History"}
      />
    </div>
  );
}
