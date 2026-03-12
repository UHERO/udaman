"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { AssessedValueChart } from "@/components/hhdb/dashboard/assessed-value-chart";
import { CondoAreaChart } from "@/components/hhdb/dashboard/condo-area-chart";
import { PermitActivityChart } from "@/components/hhdb/dashboard/permit-activity-chart";
import { PropertyCountChart } from "@/components/hhdb/dashboard/property-count-chart";
import { SalePriceChart } from "@/components/hhdb/dashboard/sale-price-chart";
import { TotalAssessedChart } from "@/components/hhdb/dashboard/total-assessed-chart";
import { cn } from "@/lib/utils";

type Tab = "about" | "metrics";

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as Tab) || "about";

  const setTab = (t: Tab) => {
    const sp = new URLSearchParams();
    if (t !== "about") sp.set("tab", t);
    const qs = sp.toString();
    router.replace(`?${qs}`);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Hawaii Housing Database</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Browse and explore Hawaii real property data
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {[
          { key: "about" as const, label: "About" },
          { key: "metrics" as const, label: "Sample Metrics" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "about" && (
        <div className="prose dark:prose-invert max-w-none">
          <div className="rounded-md border border-blue-500/50 bg-blue-500/10 px-5 py-4 text-sm text-blue-800 dark:text-blue-300">
            <p className="mt-0 font-semibold">Work in progress</p>
            <p className="mb-0">
              This interface is a starting point for browsing Hawaii real
              property data. It&apos;s useful for quick lookups and getting
              familiar with what&apos;s available, but it&apos;s not a
              substitute for proper analysis. When you&apos;re ready to do real
              work with the data, connect directly to the database with SQL.
            </p>
          </div>

          <h2 className="mt-4 text-lg font-bold">What&apos;s here</h2>
          <p>
            The tabs above give you paginated, searchable views of 22 tables
            scraped from Hawaii county real property tax websites. Each table
            has a <strong>Data</strong> tab for browsing rows and a{" "}
            <strong>Summary</strong> tab that shows value distributions broken
            down by county.
          </p>
          <p>
            Some very large tables (Tax Details, Tax Payments, Tax History) have
            search and sorting disabled because they contain millions of rows.
            For those, you&apos;ll want to query the database directly.
          </p>

          <h2 className="mt-4 text-lg font-bold">Connecting to the database</h2>
          <p>
            The housing database is a MariaDB instance. You can connect with any
            MySQL-compatible tool/library (RMariaDB, DBeaver, the{" "}
            <code>mysql</code> CLI, etc.).
          </p>
          <div className="not-prose bg-muted/50 my-4 overflow-x-auto rounded-md border p-4 font-mono text-sm">
            <table className="w-auto">
              <tbody>
                <tr>
                  <td className="text-muted-foreground pr-4">Host</td>
                  <td>128.171.200.230</td>
                </tr>
                <tr>
                  <td className="text-muted-foreground pr-4">Port</td>
                  <td>3306</td>
                </tr>
                <tr>
                  <td className="text-muted-foreground pr-4">Database</td>
                  <td>hawaii_housing_database</td>
                </tr>
                <tr>
                  <td className="text-muted-foreground pr-4">User</td>
                  <td>uhero</td>
                </tr>
                <tr>
                  <td className="text-muted-foreground pr-4">Password</td>
                  <td>
                    Check the Notion docs or slack Caleb (wood2@hawaii.edu)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            All tables are keyed by <code>tmk</code> (Tax Map Key). The first
            digit indicates the island: <strong>1</strong> = Oahu,{" "}
            <strong>2</strong> = Maui, <strong>3</strong> = Hawaii,{" "}
            <strong>4</strong> = Kauai. You can join any two tables on{" "}
            <code>tmk</code> to cross-reference property, assessment, sale, and
            tax data.
          </p>

          <h2 className="mt-4 text-lg font-bold">Tips</h2>
          <ul>
            <li>
              Use the <strong>Factors</strong> tab on any table to quickly see
              the distribution of categorical fields and min/median/max ranges
              for numeric fields, broken down by island.
            </li>
            <li>
              The historical tax tables are very large. Filter by{" "}
              <code>tmk</code> or <code>year</code> in your SQL queries to keep
              things fast.
            </li>
            <li>
              Data is scraped periodically. Check <code>scraped_at</code>{" "}
              columns to see when a record was last updated.
            </li>
          </ul>
        </div>
      )}

      {tab === "metrics" && (
        <div>
          <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            These charts show a few sample metrics to demonstrate basic insights
            from the data. They are generated from raw queries that include all
            parcels (not just residential), so don&apos;t consider them
            representative of the &quot;housing&quot; market. 2026 data has not
            been gathered.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AssessedValueChart />
            <SalePriceChart />
            <PropertyCountChart />
            <TotalAssessedChart />
            <PermitActivityChart />
            <CondoAreaChart />
          </div>
        </div>
      )}
    </div>
  );
}
