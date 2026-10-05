import { notFound } from "next/navigation";

import {
  InsuranceClaimsExploration,
  InsurancePoliciesExploration,
  RentListingsExploration,
} from "@/components/hhdb/exploration/imputed-tmk-exploration";
import { MlsListingsExploration } from "@/components/hhdb/exploration/mls-listings-exploration";
import { OwnersExploration } from "@/components/hhdb/exploration/owners-exploration";
import { TransactionsExploration } from "@/components/hhdb/exploration/transactions-exploration";
import { HHDB_TABLE_CONFIG } from "@/components/hhdb/hhdb-table-config";

const EXPLORATION_COMPONENTS: Record<string, React.ComponentType> = {
  "mls-listings": MlsListingsExploration,
  owners: OwnersExploration,
  transactions: TransactionsExploration,
  "rent-listings": RentListingsExploration,
  "insurance-policies": InsurancePoliciesExploration,
  "insurance-claims": InsuranceClaimsExploration,
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
