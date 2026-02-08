import { isValidUniverse } from "@catalog/utils/validators";
import { notFound } from "next/navigation";

export default async function UniverseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { universe: string };
}) {
  const { universe } = await params;

  if (!isValidUniverse(universe)) {
    notFound();
  }

  return <>{children}</>;
}
