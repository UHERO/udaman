"use client";

import { OutOfStateDrilldown } from "./out-of-state-drilldown";
import { OutOfStateRatioChart } from "./out-of-state-ratio-chart";
import { TransactionsByPeriodChart } from "./transactions-by-period-chart";

export function TransactionsExploration() {
  return (
    <div className="space-y-6">
      <TransactionsByPeriodChart />
      <OutOfStateRatioChart />
      <OutOfStateDrilldown />
    </div>
  );
}
