"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getHhdbImprovements } from "@/actions/hhdb";
import { ImprovementsTable } from "@/components/hhdb/tables/improvements-table";
import { HhdbFactors } from "@/components/hhdb/hhdb-factors";
import type { HhdbImprovementJSON } from "@catalog/models/hhdb-improvement";
import { cn } from "@/lib/utils";

type ImprovementType = "residential" | "commercial";
type Tab = "data" | "factors";

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const type = (searchParams.get("type") as ImprovementType) || "residential";
  const tab = (searchParams.get("tab") as Tab) || "data";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = [25, 50, 100, 250].includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : 50;
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "id";
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";

  const [data, setData] = useState<HhdbImprovementJSON[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (tab !== "data") return;
    setLoading(true);
    const result = await getHhdbImprovements(
      { page, limit, search: search || undefined, sort, order },
      type,
    );
    setData(result.rows);
    setTotal(result.total);
    setLoading(false);
  }, [page, limit, search, sort, order, type, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setType = (t: ImprovementType) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("type", t);
    sp.set("page", "1");
    router.replace(`?${sp.toString()}`);
  };

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

  const factorsTable = `${type}_improvements`;

  return (
    <div>
      <h1 className="text-3xl font-bold">Improvements</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {tab === "data" && !loading
          ? `${total.toLocaleString()} ${type} improvement records`
          : tab === "data"
            ? "Loading..."
            : `${type.charAt(0).toUpperCase() + type.slice(1)} improvement field factors`}
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {(["residential", "commercial"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              type === t
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t}
          </button>
        ))}
        <div className="mx-2 border-l" />
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
        <ImprovementsTable
          data={data}
          total={total}
          page={page}
          limit={limit}
          search={search}
          sort={sort}
          order={order}
          type={type}
        />
      )}

      {tab === "factors" && (
        <HhdbFactors key={factorsTable} tableName={factorsTable} />
      )}
    </div>
  );
}
