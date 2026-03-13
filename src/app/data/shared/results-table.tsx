"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
  RawTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { Series } from "../dbedt/types";
import { DvwModuleSeries } from "../dvw/types";
import { SortDirection, SortType, useSortableTable } from "./useSortableTable";

export default function ResultsTable({
  results,
  tableDates,
  dimensions,
  isSource,
}: {
  results: Series[] | DvwModuleSeries[];
  tableDates: string[];
  dimensions: string[];
  isSource: boolean;
}) {
  const { sortedResults, sortColumn, sortDirection, handleSort } =
    useSortableTable(results as Series[]);

  // calculates width of the main columns to allow for sticky horizontal headers
  const headerRefs = useRef<(HTMLDivElement | null)[]>([]); // array of refs
  const [headerOffsets, setHeaderOffsets] = useState<string[]>([]);

  // Assign ref to each header
  const setHeaderRef = (el: HTMLDivElement | null, index: number) => {
    headerRefs.current[index] = el;
  };

  useEffect(() => {
    let offset = 0;
    const offsets: string[] = [];

    headerRefs.current.forEach((el) => {
      if (el) {
        offsets.push(`${offset}px`);
        offset += el.offsetWidth;
      }
    });

    setHeaderOffsets(offsets);
  }, [results, tableDates]);

  function SortAlphaNumericBtns({
    column,
    sortColumn,
    sortDirection,
    handleSort,
    type,
  }: {
    column: string;
    sortColumn: string | null;
    sortDirection: SortDirection;
    handleSort: (
      column: string,
      sortDirection: SortDirection,
      type: SortType,
    ) => void;
    type: SortType;
  }) {
    return (
      <div className="flex flex-col -space-y-1">
        <ChevronUp
          onClick={() => handleSort(column, "asc", type)}
          className={cn(
            "ml-1 text-xs text-gray-400 hover:text-black",
            sortColumn === column &&
              sortDirection === "asc" &&
              "font-bold text-black",
          )}
          size={12}
        />
        <ChevronDown
          onClick={() => handleSort(column, "desc", type)}
          className={cn(
            "ml-1 text-xs text-gray-400 hover:text-black",
            sortColumn === column &&
              sortDirection === "desc" &&
              "font-bold text-black",
          )}
          size={12}
        />
      </div>
    );
  }

  return (
    <div className="relative max-h-full w-full overflow-auto rounded-md border [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin]">
      <RawTable className="size-full">
        <TableHeader className="">
          <TableRow className="">
            {dimensions?.map((column, i) => (
              <TableHead
                ref={(el) => setHeaderRef(el, i)}
                key={`${column}-${i}`}
                style={{ left: headerOffsets[i] }}
                className="sticky top-0 left-0 z-40 bg-white text-center text-[11px] whitespace-nowrap"
              >
                <div className="flex items-center justify-between">
                  <span>{column}</span>
                  <SortAlphaNumericBtns
                    column={column}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    handleSort={handleSort}
                    type="string"
                  />
                </div>
              </TableHead>
            ))}

            {tableDates.map((d, i) => (
              <TableHead
                key={`dates-${d}-${i}`}
                className="sticky top-0 z-10 bg-gray-100 text-center text-[11px] whitespace-nowrap"
              >
                <div className="flex items-center justify-between">
                  {d}
                  <SortAlphaNumericBtns
                    column={d}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    handleSort={handleSort}
                    type="number"
                  />
                </div>
              </TableHead>
            ))}
            {isSource && (
              <TableHead className="sticky top-0 z-10 w-fit bg-gray-100 text-center text-[11px] whitespace-nowrap">
                Source
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults?.map((r, i) => {
            return (
              <TableRow key={`${r.id}-${i}`}>
                {dimensions.map((c: string, i) => (
                  <TableCell
                    key={`${i}-dim`}
                    style={{ left: headerOffsets[i] }}
                    className="sticky z-20 bg-white text-left text-[11px] whitespace-nowrap"
                  >
                    {String(r[c as "Indicator" | "Area" | "Units"] ?? "")}
                  </TableCell>
                ))}

                {tableDates.map((d, j) => (
                  <TableCell
                    key={`${d}-${j + 1}`}
                    className="z-0 min-w-[70px] text-center text-[11px]"
                  >
                    {r.observations?.[d] ?? ""}
                  </TableCell>
                ))}
                {isSource && (
                  <TableCell className="z-0 w-fit text-center text-[11px] whitespace-nowrap">
                    {r.sourceDescription}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </RawTable>
    </div>
  );
}
