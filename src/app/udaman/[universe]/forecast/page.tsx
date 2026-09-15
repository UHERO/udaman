import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  redirect(`/udaman/${universe}/forecast/snapshots`);
}
