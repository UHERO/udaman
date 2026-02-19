import Link from "next/link";

import { getSnapshotDataAction } from "@/actions/forecast-snapshots";
import { ForecastSnapshotDataTable } from "@/components/forecast-snapshots/forecast-snapshot-data-table";

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
            <span className="text-muted-foreground ml-2 text-base">
              (Table)
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/udaman/${universe}/forecast/snapshots/${id}`}
            className="text-sm underline"
          >
            Chart View
          </Link>
          <Link
            href={`/udaman/${universe}/forecast/snapshots/${id}/edit`}
            className="text-sm underline"
          >
            Edit
          </Link>
        </div>
      </div>

      <ForecastSnapshotDataTable
        newForecast={data.newForecast}
        oldForecast={data.oldForecast}
        history={data.history}
        allDates={data.allDates}
      />
    </div>
  );
}
