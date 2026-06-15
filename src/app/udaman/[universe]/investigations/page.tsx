import { redirect } from "next/navigation";

export default async function InvestigationsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  redirect(`/udaman/${universe}/investigations/no-source`);
}
