import { notFound } from "next/navigation";

import { OwnersExploration } from "@/components/hhdb/exploration/owners-exploration";
import { TransactionsExploration } from "@/components/hhdb/exploration/transactions-exploration";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

const EXPLORATION_COMPONENTS: Record<string, React.ComponentType> = {
  owners: OwnersExploration,
  transactions: TransactionsExploration,
};

export default async function Page({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const config = HHDB_TABLE_CONFIG[table];
  if (!config?.exploration) return notFound();

  const Component = EXPLORATION_COMPONENTS[table];
  if (!Component) return notFound();

  return <Component />;
}
