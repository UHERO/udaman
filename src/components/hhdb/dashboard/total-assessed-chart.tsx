"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Loader2 } from "lucide-react";
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
import { getHhdbTotalAssessed } from "@/actions/hhdb";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import type { TotalAssessedRow } from "@catalog/collections/hhdb-dashboard-collection";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

export function TotalAssessedChart() {
  const [data, setData] = useState<TotalAssessedRow[] | null>(null);

  useEffect(() => {
    getHhdbTotalAssessed().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Total Assessed Value by Island</CardTitle>
          <CardDescription>Sum of assessed values by island over time</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const islands = [...new Set(data.map((d) => d.island_code))];

  const byYear = new Map<number, Record<string, unknown>>();
  for (const row of data) {
    const existing = byYear.get(row.tax_year) ?? { year: row.tax_year };
    existing[`island_${row.island_code}`] = Math.round(row.total_value);
    byYear.set(row.tax_year, existing);
  }
  const chartData = [...byYear.values()].sort(
    (a, b) => (a.year as number) - (b.year as number),
  );

  const config: ChartConfig = {};
  islands.forEach((c, i) => {
    config[`island_${c}`] = {
      label: ISLAND_NAMES[c] ?? `Island ${c}`,
      color: COLORS[i % COLORS.length],
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Assessed Value by Island</CardTitle>
        <CardDescription>Sum of assessed values by island over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(v) => `$${(v / 1e9).toFixed(1)}B`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            {islands.map((c) => {
              const key = `island_${c}`;
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={ISLAND_NAMES[c] ?? `Island ${c}`}
                  stackId="1"
                  fill={`var(--color-${key})`}
                  stroke={`var(--color-${key})`}
                />
              );
            })}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
