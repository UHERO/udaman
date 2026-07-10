"use client";

import { useEffect, useState } from "react";
import type { OwnershipLorenzResult } from "@catalog/collections/hhdb-dashboard-collection";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { getHhdbOwnershipLorenz } from "@/actions/hhdb";
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
  cumulative_property_pct: {
    label: "Cumulative Property %",
    color: "#1D667F",
  },
};

export function OwnershipLorenzChart() {
  const [islandCode, setIslandCode] = useState<string>("all");
  const [result, setResult] = useState<OwnershipLorenzResult | null>(null);

  useEffect(() => {
    setResult(null);
    getHhdbOwnershipLorenz(islandCode === "all" ? undefined : islandCode).then(
      setResult,
    );
  }, [islandCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              Lorenz Curve
              {result && (
                <span className="text-muted-foreground ml-2 text-base font-normal">
                  Gini = {result.gini.toFixed(4)}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Cumulative share of properties held by cumulative share of owners.
              The diagonal line represents perfect equality.
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
        {!result ? (
          <div className="flex h-[350px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <AreaChart data={result.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="cumulative_owner_pct"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                label={{
                  value: "Cumulative % of Owners",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                label={{
                  value: "Cumulative % of Properties",
                  angle: -90,
                  position: "insideLeft",
                }}
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
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ]}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                label=""
              />
              <Area
                type="monotone"
                dataKey="cumulative_property_pct"
                name="Cumulative Property %"
                stroke="var(--color-cumulative_property_pct)"
                fill="var(--color-cumulative_property_pct)"
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
