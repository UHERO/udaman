import {
  getLoadErrors,
  getReloadJobs,
} from "@catalog/controllers/investigations";
import UniverseCollection from "@catalog/collections/universe-collection";
import type { Universe } from "@catalog/types/shared";

import InvestigationsPanel from "@/components/investigations-panel";

export default async function InvestigationsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const uni = universe.toUpperCase() as Universe;
  const [loadErrors, reloadJobs, universes] = await Promise.all([
    getLoadErrors(uni),
    getReloadJobs(uni),
    UniverseCollection.list(),
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
        universes={universes.map((u) => u.name)}
      />
    </>
  );
}
