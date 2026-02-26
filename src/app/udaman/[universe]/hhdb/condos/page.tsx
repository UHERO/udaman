"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getHhdbCondoProjects, getHhdbCondoUnits } from "@/actions/hhdb";
import {
  CondoProjectsTable,
  CondoUnitsTable,
} from "@/components/hhdb/tables/condos-table";
import { HhdbFactors } from "@/components/hhdb/hhdb-factors";
import type { HhdbCondoProjectJSON, HhdbCondoUnitJSON } from "@catalog/models/hhdb-condo";
import { cn } from "@/lib/utils";

type CondoView = "projects" | "units";
type Tab = "data" | "factors";

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const view = (searchParams.get("view") as CondoView) || "projects";
  const tab = (searchParams.get("tab") as Tab) || "data";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = [25, 50, 100, 250].includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : 50;
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "id";
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";

  const [projects, setProjects] = useState<HhdbCondoProjectJSON[]>([]);
  const [units, setUnits] = useState<HhdbCondoUnitJSON[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (tab !== "data") return;
    setLoading(true);
    const params = { page, limit, search: search || undefined, sort, order };
    if (view === "projects") {
      const result = await getHhdbCondoProjects(params);
      setProjects(result.rows);
      setTotal(result.total);
    } else {
      const result = await getHhdbCondoUnits(params);
      setUnits(result.rows);
      setTotal(result.total);
    }
    setLoading(false);
  }, [page, limit, search, sort, order, view, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setView = (v: CondoView) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("view", v);
    sp.set("page", "1");
    // Reset to data tab when switching to units (no factors for units)
    if (v === "units") {
      sp.set("tab", "data");
    }
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

  // Only show factors tab for projects view
  const showFactorsTab = view === "projects";
  // Force data tab if on units view
  const effectiveTab = showFactorsTab ? tab : "data";

  return (
    <div>
      <h1 className="text-3xl font-bold">Condominiums</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        {effectiveTab === "data" && !loading
          ? `${total.toLocaleString()} condo ${view}`
          : effectiveTab === "data"
            ? "Loading..."
            : "Condo project field factors"}
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {(["projects", "units"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              view === v
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {v}
          </button>
        ))}
        {showFactorsTab && (
          <>
            <div className="mx-2 border-l" />
            {(["data", "factors"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
                  effectiveTab === t
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {t}
              </button>
            ))}
          </>
        )}
      </div>

      {effectiveTab === "data" && !loading && view === "projects" && (
        <CondoProjectsTable
          data={projects}
          total={total}
          page={page}
          limit={limit}
          search={search}
          sort={sort}
          order={order}
        />
      )}
      {effectiveTab === "data" && !loading && view === "units" && (
        <CondoUnitsTable
          data={units}
          total={total}
          page={page}
          limit={limit}
          search={search}
          sort={sort}
          order={order}
        />
      )}

      {effectiveTab === "factors" && (
        <HhdbFactors tableName="condominium_projects" />
      )}
    </div>
  );
}
