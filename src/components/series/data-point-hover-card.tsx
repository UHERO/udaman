"use client";

import Link from "next/link";
import { format } from "date-fns";

import {
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getColor } from "../helpers";
import { useSeriesHover } from "./series-data-section";

export function DataPointTooltip({
  value,
  date,
  universe,
  seriesId,
  decimals,
}: {
  value: string;
  xseriesId: number;
  date: string;
  universe: string;
  seriesId: number;
  decimals: number;
}) {
  const { vintages, vintagesLoaded } = useSeriesHover();
  const dateVintages = vintages[date];
  const hasVintages = dateVintages && dateVintages.length > 1;

  const href = `/udaman/${universe}/series/${seriesId}/data-points/${date}`;

  // No vintages loaded yet or only one version — just render the link
  if (!vintagesLoaded || !hasVintages) {
    return (
      <Link href={href} className="font-bold hover:underline">
        {value}
      </Link>
    );
  }

  return (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Link href={href} className="w-full font-bold hover:underline">
          {value}
        </Link>
      </TooltipTrigger>
      <TooltipContent
        align="start"
        className="bg-popover text-popover-foreground w-80 rounded-md border p-3 shadow-md"
      >
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Vintages for {date}</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="pr-2 pb-1">Value</th>
                <th className="pr-2 pb-1">Loaded</th>
                <th className="pb-1">Loader</th>
              </tr>
            </thead>
            <tbody>
              {dateVintages.map((v, i) => (
                <tr key={i} className={getColor(v.color)}>
                  <td className="py-0.5 pl-2 text-left font-mono font-semibold">
                    {v.value != null ? Number(v.value).toFixed(decimals) : "-"}
                  </td>
                  <td className="py-0.5 pr-2">
                    {format(new Date(v.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="py-0.5">{v.data_source_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TooltipContent>
    </TooltipRoot>
  );
}
