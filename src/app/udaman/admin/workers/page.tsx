import { notFound } from "next/navigation";

import { getWorkerJobs } from "@/actions/workers";
import WorkersPanel from "@/components/admin/workers-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function WorkersPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const data = await getWorkerJobs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Workers</h1>
        <p className="text-muted-foreground text-sm">
          Recent and ongoing background job status.
        </p>
      </div>

      <WorkersPanel initialData={data} />
    </div>
  );
}
