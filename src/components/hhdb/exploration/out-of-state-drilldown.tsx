"use client";

import { useEffect, useState } from "react";
import type {
  OutOfStateByStateRow,
  OutOfStateByZipRow,
} from "@catalog/collections/hhdb-dashboard-collection";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  getHhdbOutOfStateTopStates,
  getHhdbOutOfStateTopZips,
} from "@/actions/hhdb";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const stateConfig: ChartConfig = {
  transaction_count: { label: "Transactions", color: "#1D667F" },
};

const zipConfig: ChartConfig = {
  transaction_count: { label: "Transactions", color: "#4BACC6" },
};

export function OutOfStateDrilldown() {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 10);
  const [endYear, setEndYear] = useState(currentYear);
  const [stateData, setStateData] = useState<OutOfStateByStateRow[] | null>(
    null,
  );
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [zipData, setZipData] = useState<OutOfStateByZipRow[] | null>(null);

  useEffect(() => {
    setStateData(null);
    setSelectedState(null);
    setZipData(null);
    getHhdbOutOfStateTopStates(startYear, endYear).then(setStateData);
  }, [startYear, endYear]);

  useEffect(() => {
    if (!selectedState) {
      setZipData(null);
      return;
    }
    setZipData(null);
    getHhdbOutOfStateTopZips(selectedState, startYear, endYear).then(
      setZipData,
    );
  }, [selectedState, startYear, endYear]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Top Source States</CardTitle>
              <CardDescription>
                Click a bar to drill down into zip codes for that state
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">From</Label>
              <Input
                type="number"
                className="h-8 w-20"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
              />
              <Label className="text-xs">To</Label>
              <Input
                type="number"
                className="h-8 w-20"
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!stateData ? (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ChartContainer
              config={stateConfig}
              className="h-[400px] w-full"
            >
              <BarChart data={stateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="mailing_state"
                  width={40}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const pct = (
                          (item.payload as OutOfStateByStateRow).pct * 100
                        ).toFixed(1);
                        return `${Number(value).toLocaleString()} (${pct}%)`;
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="transaction_count"
                  name="Transactions"
                  fill="var(--color-transaction_count)"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const state = (data as OutOfStateByStateRow).mailing_state;
                    setSelectedState(
                      state === selectedState ? null : state,
                    );
                  }}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {selectedState && (
        <Card>
          <CardHeader>
            <CardTitle>
              Top Zip Codes from {selectedState}
            </CardTitle>
            <CardDescription>
              Most active source zip codes for out-of-state buyers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!zipData ? (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ChartContainer
                config={zipConfig}
                className="h-[400px] w-full"
              >
                <BarChart
                  data={zipData.slice(0, 20)}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="mailing_zip_code"
                    width={60}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => {
                          const row = item.payload as OutOfStateByZipRow;
                          const city = row.mailing_city
                            ? ` (${row.mailing_city})`
                            : "";
                          return `${Number(value).toLocaleString()}${city}`;
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="transaction_count"
                    name="Transactions"
                    fill="var(--color-transaction_count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
