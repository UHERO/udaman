"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
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
import { getHhdbPermitActivity } from "@/actions/hhdb";
import type { PermitActivityRow } from "@catalog/collections/hhdb-dashboard-collection";

const config: ChartConfig = {
  permit_count: { label: "Permits", color: "#2563eb" },
  total_value: { label: "Total Value ($)", color: "#16a34a" },
};

export function PermitActivityChart() {
  const [data, setData] = useState<PermitActivityRow[] | null>(null);

  useEffect(() => {
    getHhdbPermitActivity().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permit Activity by Year</CardTitle>
          <CardDescription>Permit count and total amount by year</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permit Activity by Year</CardTitle>
        <CardDescription>Permit count and total amount by year</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => v.toLocaleString()}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="permit_count"
              name="Permits"
              fill="var(--color-permit_count)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="total_value"
              name="Total Value ($)"
              fill="var(--color-total_value)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
