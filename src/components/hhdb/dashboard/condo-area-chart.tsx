"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
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
import { getHhdbCondoArea } from "@/actions/hhdb";
import type { CondoAreaRow } from "@catalog/collections/hhdb-dashboard-collection";

const config: ChartConfig = {
  median_living_area: {
    label: "Avg Living Area (sq ft)",
    color: "#9333ea",
  },
};

export function CondoAreaChart() {
  const [data, setData] = useState<CondoAreaRow[] | null>(null);

  useEffect(() => {
    getHhdbCondoArea().then(setData);
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Residential Living Area by Year Built</CardTitle>
          <CardDescription>Average living area by construction year</CardDescription>
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
        <CardTitle>Residential Living Area by Year Built</CardTitle>
        <CardDescription>Average living area by construction year</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year_built" />
            <YAxis tickFormatter={(v) => v.toLocaleString()} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="median_living_area"
              name="Avg Living Area"
              stroke="var(--color-median_living_area)"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
