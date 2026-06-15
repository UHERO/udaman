import { notFound } from "next/navigation";

import { getStats } from "@/actions/stats";
import StatsPanel from "@/components/admin/stats-panel";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function StatsPage() {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "dev") {
    notFound();
  }

  const data = await getStats(30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="text-muted-foreground text-sm">
          Usage statistics derived from application logs.
        </p>
      </div>
      <WidthToggleBar />

      <StatsPanel initialData={data} initialDays={30} />
    </div>
  );
}
