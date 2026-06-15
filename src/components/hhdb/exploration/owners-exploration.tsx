"use client";

import { ConcentrationByIslandChart } from "./concentration-by-island-chart";
import { OwnershipDistributionChart } from "./ownership-distribution-chart";
import { OwnershipLorenzChart } from "./ownership-lorenz-chart";
import { TopOwnersChart } from "./top-owners-chart";

export function OwnersExploration() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <OwnershipDistributionChart />
        <OwnershipLorenzChart />
      </div>
      <ConcentrationByIslandChart />
      <TopOwnersChart />
    </div>
  );
}
