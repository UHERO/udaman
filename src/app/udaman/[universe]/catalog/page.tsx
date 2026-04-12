import {
  canDeleteUniverse,
  getUniverses,
  getUniverseStats,
} from "@/actions/universes";
import { UniverseList } from "@/components/universe/universe-list";
import { UniverseOverview } from "@/components/universe/universe-overview";

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const name = universe.toUpperCase();

  const [universes, stats, canDelete] = await Promise.all([
    getUniverses(),
    getUniverseStats(name),
    canDeleteUniverse(),
  ]);

  const current = universes.find((u) => u.name.toUpperCase() === name);

  return (
    <div>
      <h1 className="text-3xl font-bold">Universe</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Overview and settings for this universe.
      </p>

      <UniverseOverview
        name={name}
        description={current?.description ?? null}
        dataPortalUrl={current?.dataPortalUrl ?? null}
        stats={stats}
        canDelete={canDelete}
        universes={universes}
      />
      <UniverseList universes={universes} current={name} />
    </div>
  );
}
