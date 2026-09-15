"use client";

import { useEffect, useState } from "react";
import type { ConcentrationByIslandRow } from "@catalog/collections/hhdb-dashboard-collection";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { getHhdbConcentrationByIsland } from "@/actions/hhdb";
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

const chartConfig: ChartConfig = {
  gini: { label: "Gini Coefficient", color: "#1D667F" },
  top10_pct: { label: "Top 10% Share", color: "#F6A01B" },
  single_owner_pct: { label: "Single-Property %", color: "#9BBB59" },
};

export function ConcentrationByIslandChart() {
  const [data, setData] = useState<ConcentrationByIslandRow[] | null>(null);

  useEffect(() => {
    getHhdbConcentrationByIsland().then(setData);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concentration by Island</CardTitle>
        <CardDescription>
          Gini coefficient, top-10% property share, and single-property owner
          percentage across islands
        </CardDescription>
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
              <XAxis dataKey="island_name" />
              <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `${(Number(value) * 100).toFixed(1)}%`
                    }
                  />
                }
              />
              <Legend />
              <Bar
                dataKey="gini"
                name="Gini Coefficient"
                fill="var(--color-gini)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="top10_pct"
                name="Top 10% Share"
                fill="var(--color-top10_pct)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="single_owner_pct"
                name="Single-Property %"
                fill="var(--color-single_owner_pct)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
