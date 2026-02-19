import { getSnapshotAction } from "@/actions/forecast-snapshots";
import { ForecastSnapshotForm } from "@/components/forecast-snapshots/forecast-snapshot-form";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = await getSnapshotAction(Number(id));

  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">Edit Forecast Snapshot</h1>
      <ForecastSnapshotForm snapshot={snapshot} />
    </div>
  );
}
