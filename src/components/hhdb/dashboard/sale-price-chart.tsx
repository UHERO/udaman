"use client";

import { useEffect, useState } from "react";
import type { MedianSalePriceRow } from "@catalog/collections/hhdb-dashboard-collection";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";

import { getHhdbMedianSalePrice } from "@/actions/hhdb";
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

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];

export function SalePriceChart() {
  const [data, setData] = useState<MedianSalePriceRow[] | null>(null);

  useEffect(() => {
    getHhdbMedianSalePrice().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avg Sale Price by Island</CardTitle>
          <CardDescription>
            Average sale price by island over time
          </CardDescription>
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
    const existing = byYear.get(row.year) ?? { year: row.year };
    existing[`island_${row.island_code}`] = Math.round(row.median_price);
    byYear.set(row.year, existing);
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
        <CardTitle>Avg Sale Price by Island</CardTitle>
        <CardDescription>
          Average sale price by island over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            {islands.map((c) => {
              const key = `island_${c}`;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={ISLAND_NAMES[c] ?? `Island ${c}`}
                  stroke={`var(--color-${key})`}
                  dot={false}
                  strokeWidth={2}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
