import { listSnapshotsAction } from "@/actions/forecast-snapshots";
import { ForecastSnapshotListTable } from "@/components/forecast-snapshots/forecast-snapshot-list-table";

export default async function Page() {
  const data = await listSnapshotsAction();

  return (
    <div>
      <h1 className="text-3xl font-bold">Forecast Snapshots</h1>
      <p className="text-muted-foreground text-sm">
        Compare forecast rounds with point-in-time snapshots.
      </p>
      <div className="mt-4">
        <ForecastSnapshotListTable data={data} />
      </div>
    </div>
  );
}
