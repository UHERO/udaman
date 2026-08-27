"use client";

import { useEffect, useState } from "react";
import type { OutOfStateRatioRow } from "@catalog/collections/hhdb-dashboard-collection";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { getHhdbOutOfStateRatio } from "@/actions/hhdb";
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
  ratio: { label: "Out-of-State %", color: "#1D667F" },
};

export function OutOfStateRatioChart() {
  const [islandCode, setIslandCode] = useState<string>("all");
  const [data, setData] = useState<OutOfStateRatioRow[] | null>(null);

  useEffect(() => {
    setData(null);
    getHhdbOutOfStateRatio(islandCode === "all" ? undefined : islandCode).then(
      setData,
    );
  }, [islandCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Out-of-State Buyer Ratio</CardTitle>
            <CardDescription>
              Percentage of property transactions with out-of-state buyers by
              quarter
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
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={(v) => {
                  const year = v.split("-")[0];
                  return v.endsWith("Q1") ? year : "";
                }}
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, "auto"]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `${(Number(value) * 100).toFixed(1)}%`
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="ratio"
                name="Out-of-State %"
                stroke="var(--color-ratio)"
                fill="var(--color-ratio)"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
