import { redirect } from "next/navigation";

export default async function DataToolsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  redirect(`/udaman/${universe}/data-tools/tsd`);
}
