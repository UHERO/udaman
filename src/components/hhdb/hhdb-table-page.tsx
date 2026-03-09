"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { HhdbTableConfig } from "@/components/hhdb/hhdb-table-config";
import { getTableAction, renderTable } from "@/components/hhdb/hhdb-table-registry";
import { HhdbTableLoadingContext } from "@/components/hhdb/hhdb-loading-context";

interface HhdbTablePageProps {
  slug: string;
  config: HhdbTableConfig;
}

export function HhdbTablePage({ slug, config }: HhdbTablePageProps) {
  const searchParams = useSearchParams();
  const action = getTableAction(slug)!;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = [25, 50, 100, 250].includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : 50;
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? config.defaultSort;
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const result = await action({
        page,
        limit,
        search: search || undefined,
        sort,
        order,
      });
      setData(result.rows);
      setTotal(result.total);
      setHasLoaded(true);
    });
  }, [action, page, limit, search, sort, order, startTransition]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!hasLoaded) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <HhdbTableLoadingContext.Provider value={isPending}>
      {renderTable(slug, { data, total, page, limit, search, sort, order })}
    </HhdbTableLoadingContext.Provider>
  );
}
