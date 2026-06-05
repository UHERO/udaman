"use client";

import { useEffect, useState } from "react";
import type { TopOwnerRow } from "@catalog/collections/hhdb-dashboard-collection";
import { ISLAND_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { getHhdbTopOwners } from "@/actions/hhdb";
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
  property_count: { label: "Properties", color: "#8064A2" },
};

function truncateName(name: string, maxLen = 30): string {
  return name.length > maxLen ? `${name.slice(0, maxLen)}...` : name;
}

export function TopOwnersChart() {
  const [islandCode, setIslandCode] = useState<string>("all");
  const [data, setData] = useState<TopOwnerRow[] | null>(null);

  useEffect(() => {
    setData(null);
    getHhdbTopOwners(
      25,
      islandCode === "all" ? undefined : islandCode,
    ).then(setData);
  }, [islandCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Top Property Owners</CardTitle>
            <CardDescription>
              Largest multi-property owners by portfolio size
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
          <div className="flex h-[500px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[500px] w-full">
            <BarChart
              data={data.map((d) => ({
                ...d,
                display_name: truncateName(d.owner_name),
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="display_name"
                width={200}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const row = item.payload as TopOwnerRow;
                      const islands = row.island_codes
                        .split(",")
                        .map((c) => ISLAND_NAMES[c] ?? c)
                        .join(", ");
                      return `${Number(value).toLocaleString()} properties (${islands})`;
                    }}
                  />
                }
              />
              <Bar
                dataKey="property_count"
                name="Properties"
                fill="var(--color-property_count)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
