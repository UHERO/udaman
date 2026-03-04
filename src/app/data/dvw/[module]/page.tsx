import { notFound } from "next/navigation";

type Module = "trend" | "char" | "airseat" | "exp" | "hotel";
const modules: string[] = ["trend", "char", "airseat", "exp", "hotel"];

export default async function ModulePage({
  params,
}: {
  params: { module: Module };
}) {
  const { module } = params;

  if (!module || !modules.includes(module)) return notFound();

  return (
    <div className="fixed inset-0">
      <iframe
        src={`https://analytics.uhero.hawaii.edu/alpha/data/dvw/${module}`}
        className="size-full border-0"
        title="DVW Data Portal"
      />
    </div>
  );
}
