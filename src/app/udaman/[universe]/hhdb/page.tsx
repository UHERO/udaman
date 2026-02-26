import { AssessedValueChart } from "@/components/hhdb/dashboard/assessed-value-chart";
import { SalePriceChart } from "@/components/hhdb/dashboard/sale-price-chart";
import { PropertyCountChart } from "@/components/hhdb/dashboard/property-count-chart";
import { TotalAssessedChart } from "@/components/hhdb/dashboard/total-assessed-chart";
import { PermitActivityChart } from "@/components/hhdb/dashboard/permit-activity-chart";
import { CondoAreaChart } from "@/components/hhdb/dashboard/condo-area-chart";

export default function Page() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Housing Database</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Hawaii Housing Database dashboard and analytics
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <AssessedValueChart />
        <SalePriceChart />
        <PropertyCountChart />
        <TotalAssessedChart />
        <PermitActivityChart />
        <CondoAreaChart />
      </div>
    </div>
  );
}
