import { redirect } from "next/navigation";

export default async function UploadsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  redirect(`/udaman/${universe}/uploads/econ`);
}
