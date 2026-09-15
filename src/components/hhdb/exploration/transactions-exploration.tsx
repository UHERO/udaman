"use client";

import { OutOfStateDrilldown } from "./out-of-state-drilldown";
import { OutOfStateRatioChart } from "./out-of-state-ratio-chart";

export function TransactionsExploration() {
  return (
    <div className="space-y-6">
      <OutOfStateRatioChart />
      <OutOfStateDrilldown />
    </div>
  );
}
