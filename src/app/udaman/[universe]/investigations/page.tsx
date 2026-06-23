import {
  getLoadErrors,
  getReloadJobs,
} from "@catalog/controllers/investigations";
import type { Universe } from "@catalog/types/shared";
import InvestigationsPanel from "@/components/investigations-panel";

export default async function InvestigationsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const uni = universe.toUpperCase() as Universe;
  const [loadErrors, reloadJobs] = await Promise.all([
    getLoadErrors(uni),
    getReloadJobs(uni),
  ]);
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Investigations</h1>
        <p className="text-muted-foreground text-sm">
          Admin actions, reload job history, and current load errors.
        </p>
      </div>
      <InvestigationsPanel
        loadErrors={loadErrors}
        reloadJobs={reloadJobs}
        universe={universe}
      />
    </>
  );
}
