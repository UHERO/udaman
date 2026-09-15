import { DeleteSeriesForm } from "@/components/series/delete-series-form";

export default async function DeleteSeriesPage({
  params,
}: {
  params: Promise<{ universe: string; id: number }>;
}) {
  const { universe, id } = await params;
  return <DeleteSeriesForm seriesId={id} universe={universe} />;
}
