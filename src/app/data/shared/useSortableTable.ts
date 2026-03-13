import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc" | null;
export type SortType = "string" | "number";

type CustomAccessors<T> = Record<string, (item: T) => any>;

/*
  useSortableTable custom hook sorts each column alphabetically
  or numerically based on user selection
*/
export function useSortableTable<T>(
  data: T[],
  customAccessors: CustomAccessors<T> = {},
) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [sortType, setSortType] = useState<SortType | null>(null);

  const handleSort = (
    column: string,
    direction: SortDirection,
    type: SortType,
  ) => {
    if (sortColumn === column && sortDirection === direction) {
      setSortColumn(null);
      setSortDirection(null);
      setSortType(null);
      return;
    }

    setSortColumn(column);
    setSortDirection(direction);
    setSortType(type);
  };

  const sortedResults = useMemo(() => {
    if (!sortColumn || !sortDirection || !sortType) return data;

    const getValue = (item: T): any => {
      const value = (item as any)?.[sortColumn];

      if (value !== undefined) return value;

      const obsValue = (item as any)?.observations?.[sortColumn];
      if (typeof obsValue === "string") {
        const numeric = parseFloat(obsValue.replace(/,/g, ""));
        if (!isNaN(numeric)) return numeric;
      }

      return "";
    };

    return [...data].sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);

      if (typeof aVal === "undefined" || typeof bVal === "undefined") return 0;

      if (sortType === "string") {
        return sortDirection === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      return sortDirection === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });
  }, [data, sortColumn, sortDirection, sortType, customAccessors]);

  return {
    sortedResults,
    sortColumn,
    sortDirection,
    handleSort,
  };
}
