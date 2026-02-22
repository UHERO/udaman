import { notFound } from "next/navigation";

import { getSchedulers } from "@/actions/workers";
import SchedulesPanel from "@/components/admin/schedules-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function SchedulesPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const schedulers = await getSchedulers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Schedules</h1>
        <p className="text-muted-foreground text-sm">
          Cron schedules and upcoming job runs.
        </p>
      </div>

      <SchedulesPanel initialData={schedulers} />
    </div>
  );
}
