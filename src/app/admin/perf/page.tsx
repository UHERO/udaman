import { notFound } from "next/navigation";

import { getPerfData } from "@/actions/perf";
import PerfPanel from "@/components/admin/perf-panel";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function PerfPage() {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "dev") {
    notFound();
  }

  const data = await getPerfData(30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Performance</h1>
        <p className="text-muted-foreground text-sm">
          Background job durations, queue wait, worker memory, and loader
          health, from the worker&apos;s own job records.
        </p>
      </div>
      <WidthToggleBar />

      <PerfPanel initialData={data} initialDays={30} />
    </div>
  );
}
