import { Universe } from "@catalog/types/shared";

import { CreateLoaderForm } from "@/components/loaders/create-loader-form";

export default async function DataLoaderPage({
  params,
}: {
  params: { universe: Universe };
}) {
  const { universe } = await params;
  return <CreateLoaderForm universe={universe} />;
}
