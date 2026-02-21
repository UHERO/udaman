import { notFound } from "next/navigation";

import InvestigationsPanel from "@/components/admin/investigations-panel";
import {
  getLoadErrors,
  getReloadJobs,
} from "@catalog/controllers/investigations";
import { requireAuth } from "@/lib/auth/dal";

export default async function InvestigationsPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const [loadErrors, reloadJobs] = await Promise.all([
    getLoadErrors(),
    getReloadJobs(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Investigations</h1>
        <p className="text-muted-foreground text-sm">
          Admin actions, reload job history, and current load errors.
        </p>
      </div>

      <InvestigationsPanel loadErrors={loadErrors} reloadJobs={reloadJobs} />
    </div>
  );
}
