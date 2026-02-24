import { listSnapshotsAction } from "@/actions/forecast-snapshots";
import { ForecastSnapshotListTable } from "@/components/forecast-snapshots/forecast-snapshot-list-table";
import { isFsonly } from "@/lib/auth/authorization";
import { getCurrentUserRole } from "@/lib/auth/dal";

export default async function Page() {
  const role = await getCurrentUserRole();
  let data = await listSnapshotsAction();

  // fsonly users can only see published snapshots
  if (isFsonly(role)) {
    data = data.filter(
      (s: { published?: boolean }) => s.published === true,
    );
  }

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
