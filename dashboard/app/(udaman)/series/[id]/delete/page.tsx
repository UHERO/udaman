import { DeleteSeriesForm } from "@/components/series/delete-series-form";

export default async function DeleteSeriesPage({
  params,
  searchParams,
}: {
  params: { id: number };
  searchParams: { u: Universe | undefined };
}) {
  const { id } = await params;
  const { u } = await searchParams;
  return <DeleteSeriesForm seriesId={id} />;
}
