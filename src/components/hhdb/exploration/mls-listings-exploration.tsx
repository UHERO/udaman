"use client";

import { useEffect, useState } from "react";
import type { MlsExplorationData } from "@catalog/controllers/hhdb";
import { getDictionaryLabel } from "@catalog/types/hhdb-data-dictionary";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { getHhdbMlsExploration } from "@/actions/hhdb";
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
import { MLS_COMPLETENESS_COLUMNS } from "@/core/crawlers/mls/columns";

const STATUS_CONFIG: ChartConfig = {
  open: { label: "Open (active / under contract / pending)", color: "#1D667F" },
  sold: { label: "Sold", color: "#9BBB59" },
  off_market: { label: "Off market (withdrawn / expired)", color: "#B0B0B0" },
};

const MEDIAN_CONFIG: ChartConfig = {
  sf: { label: "Single Family", color: "#1D667F" },
  condo: { label: "Condo/Townhouse", color: "#F6A01B" },
};
const MEDIAN_KEYS: Record<string, "sf" | "condo"> = {
  "Single Family": "sf",
  "Condo/Townhouse": "condo",
};

const SOURCE_CONFIG: ChartConfig = {
  hicentral: { label: "HiCentral (Oahu board)", color: "#1D667F" },
  hres: { label: "hawaiirealestatesearch.com", color: "#F6A01B" },
};

const COUNT_CONFIG: ChartConfig = {
  count: { label: "Listings", color: "#1D667F" },
};

const money = (v: unknown) =>
  `$${Math.round(Number(v)).toLocaleString("en-US")}`;
const compactMoney = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : `$${Math.round(v / 1000)}k`;
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return mo === "01" ? y : `${mo}/${y.slice(2)}`;
};

function Spinner() {
  return (
    <div className="flex h-[300px] items-center justify-center">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  );
}

function ListingsPerMonth({ data }: { data: MlsExplorationData }) {
  const { coverage, monthly } = data;
  const missing = coverage.total - coverage.with_list_date;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Listings per Month</CardTitle>
        <CardDescription>
          By list date, stacked by current status. Recent months are mostly
          still open; older months are only listings that closed and are still
          served by the source — so the left side is sales history, not the
          market at the time.{" "}
          {missing > 0 &&
            `${missing.toLocaleString()} of ${coverage.total.toLocaleString()} listings have no list date and are not shown.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={STATUS_CONFIG} className="h-[300px] w-full">
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={monthLabel} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar dataKey="sold" stackId="s" fill="var(--color-sold)" />
            <Bar dataKey="open" stackId="s" fill="var(--color-open)" />
            <Bar
              dataKey="off_market"
              stackId="s"
              fill="var(--color-off_market)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MedianListPrice({ data }: { data: MlsExplorationData }) {
  // Pivot long rows → one row per month with a column per property type.
  const byMonth = new Map<string, Record<string, number | string>>();
  for (const r of data.medians) {
    const row = byMonth.get(r.month) ?? { month: r.month };
    const key = MEDIAN_KEYS[r.property_type];
    if (!key) continue;
    row[key] = r.median_list_price;
    row[`${key}_n`] = r.listings;
    byMonth.set(r.month, row);
  }
  const rows = [...byMonth.values()];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Median List Price per Month</CardTitle>
        <CardDescription>
          Asking price at listing, by list-date month. Houses and condos are
          shown separately because a combined median moves with the mix, not
          with prices. Months with fewer than 5 listings of a type are omitted.
          This is what sellers asked, not what buyers paid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={MEDIAN_CONFIG} className="h-[300px] w-full">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={monthLabel} />
            <YAxis tickFormatter={compactMoney} width={64} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const n = item.payload?.[`${String(item.dataKey)}_n`];
                    return (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium">
                          {money(value)}
                          {n ? ` (n=${n})` : ""}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="sf"
              name="Single Family"
              stroke="var(--color-sf)"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="condo"
              name="Condo/Townhouse"
              stroke="var(--color-condo)"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PropertyTypes({ data }: { data: MlsExplorationData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Types</CardTitle>
        <CardDescription>
          All listings. Vacant Land, Commercial and Farm come only from
          hawaiirealestatesearch.com; HiCentral&apos;s public search lists
          residential only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={COUNT_CONFIG} className="h-[300px] w-full">
          <BarChart data={data.propertyTypes} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="property_type" type="category" width={120} />
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

function ListingsPerIsland({ data }: { data: MlsExplorationData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Listings per Island</CardTitle>
        <CardDescription>
          All listings, stacked by current status. Oahu comes from HiCentral
          (sold price and date recorded); the neighbor islands come from
          hawaiirealestatesearch.com, which reports closings without a sale
          date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={STATUS_CONFIG} className="h-[300px] w-full">
          <BarChart data={data.islands}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="island" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar dataKey="sold" stackId="s" fill="var(--color-sold)" />
            <Bar dataKey="open" stackId="s" fill="var(--color-open)" />
            <Bar
              dataKey="off_market"
              stackId="s"
              fill="var(--color-off_market)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function FieldCompleteness({ data }: { data: MlsExplorationData }) {
  const sites = [...new Set(data.completeness.map((r) => r.source_site))];
  const listingsBySite = new Map(
    data.completeness.map((r) => [r.source_site, r.listings]),
  );
  // One row per column, a rate + count per site.
  const rows = MLS_COMPLETENESS_COLUMNS.map((column) => {
    const row: Record<string, string | number> = {
      column,
      label: getDictionaryLabel("mls_listings", column) ?? column,
    };
    for (const r of data.completeness) {
      if (r.column !== column) continue;
      row[r.source_site] = r.rate;
      row[`${r.source_site}_filled`] = r.filled;
    }
    return row;
  });
  const config: ChartConfig = Object.fromEntries(
    sites.map((s) => [s, SOURCE_CONFIG[s] ?? { label: s, color: "#9BBB59" }]),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Completeness by Source</CardTitle>
        <CardDescription>
          Share of listings with a value, per source (
          {sites
            .map(
              (s) =>
                `${String(config[s].label)}: ${(listingsBySite.get(s) ?? 0).toLocaleString()} listings`,
            )
            .join("; ")}
          ). Gaps are what the source doesn&apos;t publish, not scrape failures:
          hawaiirealestatesearch.com has no sale date, remarks or agent, and its
          closed listings carry no TMK.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[460px] w-full">
          <BarChart data={rows} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
            />
            <YAxis dataKey="label" type="category" width={130} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium">
                        {(Number(value) * 100).toFixed(1)}% (
                        {Number(
                          item.payload?.[`${String(item.dataKey)}_filled`] ?? 0,
                        ).toLocaleString()}
                        )
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Legend />
            {sites.map((s) => (
              <Bar
                key={s}
                dataKey={s}
                name={String(config[s].label)}
                fill={`var(--color-${s})`}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function MlsListingsExploration() {
  const [data, setData] = useState<MlsExplorationData | null>(null);
  useEffect(() => {
    getHhdbMlsExploration().then(setData);
  }, []);

  if (!data) return <Spinner />;
  return (
    <div className="space-y-6">
      <ListingsPerMonth data={data} />
      <MedianListPrice data={data} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PropertyTypes data={data} />
        <ListingsPerIsland data={data} />
      </div>
      <FieldCompleteness data={data} />
    </div>
  );
}
