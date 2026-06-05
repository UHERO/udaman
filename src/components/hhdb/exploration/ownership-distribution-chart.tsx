"use client";

import { useEffect, useState } from "react";
import type { OwnershipDistributionRow } from "@catalog/collections/hhdb-dashboard-collection";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { getHhdbOwnershipDistribution } from "@/actions/hhdb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const chartConfig: ChartConfig = {
  pct_of_properties: { label: "% of Properties", color: "#1D667F" },
};

export function OwnershipDistributionChart() {
  const [islandCode, setIslandCode] = useState<string>("all");
  const [data, setData] = useState<OwnershipDistributionRow[] | null>(null);

  useEffect(() => {
    setData(null);
    getHhdbOwnershipDistribution(
      islandCode === "all" ? undefined : islandCode,
    ).then(setData);
  }, [islandCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Ownership Distribution</CardTitle>
            <CardDescription>
              Properties held per owner — single vs multi-property ownership
            </CardDescription>
          </div>
          <Select value={islandCode} onValueChange={setIslandCode}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Islands</SelectItem>
              {Object.entries(ISLAND_NAMES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" label={{ value: "Properties per Owner", position: "insideBottom", offset: -5 }} />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const row = item.payload as OwnershipDistributionRow;
                      return `${(Number(value) * 100).toFixed(1)}% (${row.owner_count.toLocaleString()} owners, ${row.property_count.toLocaleString()} properties)`;
                    }}
                  />
                }
              />
              <Bar
                dataKey="pct_of_properties"
                name="% of Properties"
                fill="var(--color-pct_of_properties)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
