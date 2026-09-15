import Link from "next/link";

export type Dependent = { id: number; name: string };

/**
 * "Who depends on me" block — lists first-order dependent series.
 * Rendered on the series show page between the metadata table and the
 * chart. Hidden entirely when nothing depends on the series.
 *
 * Ports the block at Rails app/views/series/show.html.erb:162-169.
 */
export function DependentsList({
  dependents,
  universe,
}: {
  dependents: Dependent[];
  universe: string;
}) {
  if (dependents.length === 0) return null;

  return (
    <div className="p-1">
      <h3 className="mb-1 text-sm font-semibold opacity-80">
        Who depends on me ({dependents.length})
      </h3>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {dependents.map((d) => (
          <Link
            key={d.id}
            href={`/udaman/${universe}/series/${d.id}`}
            className="hover:text-primary whitespace-nowrap hover:underline"
          >
            {d.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
