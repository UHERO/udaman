import { ForecastSnapshotForm } from "@/components/forecast-snapshots/forecast-snapshot-form";

export default function Page() {
  return (
    <div>
      <h1 className="mb-4 text-3xl font-bold">New Forecast Snapshot</h1>
      <ForecastSnapshotForm />
    </div>
  );
}
