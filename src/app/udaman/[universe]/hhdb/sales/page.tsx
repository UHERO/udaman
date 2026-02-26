"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getHhdbSales } from "@/actions/hhdb";
import { SalesTable } from "@/components/hhdb/tables/sales-table";
import { HhdbFactors } from "@/components/hhdb/hhdb-factors";
import type { HhdbSaleJSON } from "@catalog/models/hhdb-sale";
import { cn } from "@/lib/utils";

type Tab = "data" | "factors";

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = (searchParams.get("tab") as Tab) || "data";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = [25, 50, 100, 250].includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : 50;
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "id";
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";

  const [data, setData] = useState<HhdbSaleJSON[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (tab !== "data") return;
    setLoading(true);
    const result = await getHhdbSales({
      page,
      limit,
      search: search || undefined,
      sort,
      order,
    });
    setData(result.rows);
    setTotal(result.total);
    setLoading(false);
  }, [page, limit, search, sort, order, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setTab = (t: Tab) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", t);
    if (t === "factors") {
      sp.delete("page");
      sp.delete("search");
      sp.delete("sort");
      sp.delete("order");
    }
    router.replace(`?${sp.toString()}`);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Sales</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {tab === "data" && !loading
          ? `${total.toLocaleString()} sale records`
          : tab === "data"
            ? "Loading..."
            : "Sale field factors"}
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {(["data", "factors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "data" && !loading && (
        <SalesTable
          data={data}
          total={total}
          page={page}
          limit={limit}
          search={search}
          sort={sort}
          order={order}
        />
      )}

      {tab === "factors" && <HhdbFactors tableName="sales" />}
    </div>
  );
}
