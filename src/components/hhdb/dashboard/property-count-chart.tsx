"use client";

import { useEffect, useState } from "react";
import type { PropertyCountRow } from "@catalog/collections/hhdb-dashboard-collection";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { getHhdbPropertyCount } from "@/actions/hhdb";
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

const config: ChartConfig = {
  count: { label: "Properties", color: "#2563eb" },
};

export function PropertyCountChart() {
  const [data, setData] = useState<PropertyCountRow[] | null>(null);

  useEffect(() => {
    getHhdbPropertyCount().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Count by Class</CardTitle>
          <CardDescription>Top 15 property classes by count</CardDescription>
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
        <CardTitle>Property Count by Class</CardTitle>
        <CardDescription>Top 15 property classes by count</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} />
            <YAxis
              dataKey="property_class"
              type="category"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
