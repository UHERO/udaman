"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getDataPointVintages } from "@/actions/series-actions";
import type { VintageDataPoint } from "@catalog/collections/data-point-collection";
import { getColor } from "../helpers";

export function DataPointHoverCard({
  value,
  xseriesId,
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
  const [vintages, setVintages] = useState<VintageDataPoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (open: boolean) => {
    if (open && vintages === null) {
      setLoading(true);
      const data = await getDataPointVintages(xseriesId, date);
      setVintages(data);
      setLoading(false);
    }
  };

  const href = `/udaman/${universe}/series/${seriesId}/data-points/${date}`;

  return (
    <HoverCard openDelay={300} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <Link href={href} className="font-bold hover:underline">
          {value}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Vintages for {date}</h4>
          {loading ? (
            <p className="text-muted-foreground text-xs">Loading...</p>
          ) : vintages && vintages.length > 1 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="pb-1 pr-2">Value</th>
                  <th className="pb-1 pr-2">Loaded</th>
                  <th className="pb-1">Loader</th>
                </tr>
              </thead>
              <tbody>
                {vintages.map((v, i) => (
                  <tr
                    key={i}
                    className={getColor(v.color)}
                  >
                    <td className="py-0.5 pr-2 text-end font-mono font-semibold">
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
          ) : (
            <p className="text-muted-foreground text-xs">No previous versions</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
