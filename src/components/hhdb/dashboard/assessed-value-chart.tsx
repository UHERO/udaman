"use client";

import { useEffect, useState } from "react";
import type { MedianAssessedRow } from "@catalog/collections/hhdb-dashboard-collection";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";

import { getHhdbMedianAssessed } from "@/actions/hhdb";
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

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c"];

function sanitizeKey(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

export function AssessedValueChart() {
  const [data, setData] = useState<MedianAssessedRow[] | null>(null);

  useEffect(() => {
    getHhdbMedianAssessed().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avg Assessed Value by Class</CardTitle>
          <CardDescription>
            Average assessed value by property class over time
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const rawClasses = [...new Set(data.map((d) => d.property_class))].slice(
    0,
    5,
  );
  const keyMap = new Map(rawClasses.map((c) => [c, sanitizeKey(c)]));

  const byYear = new Map<number, Record<string, unknown>>();
  for (const row of data) {
    const key = keyMap.get(row.property_class);
    if (!key) continue;
    const existing = byYear.get(row.tax_year) ?? { year: row.tax_year };
    existing[key] = Math.round(row.median_value);
    byYear.set(row.tax_year, existing);
  }
  const chartData = [...byYear.values()].sort(
    (a, b) => (a.year as number) - (b.year as number),
  );

  const config: ChartConfig = {};
  rawClasses.forEach((c, i) => {
    config[keyMap.get(c)!] = { label: c, color: COLORS[i % COLORS.length] };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avg Assessed Value by Class</CardTitle>
        <CardDescription>
          Average assessed value by property class over time
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
            {rawClasses.map((c) => {
              const key = keyMap.get(c)!;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={c}
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
