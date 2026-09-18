import { CreateLoaderForm } from "@/components/loaders/create-loader-form";

export default async function DataLoaderPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  return <CreateLoaderForm universe={universe} />;
}
