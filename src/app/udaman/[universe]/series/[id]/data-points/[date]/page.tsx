import Link from "next/link";
import type { Universe } from "@catalog/types/shared";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { getDataPointVintages, getSeriesById } from "@/actions/series-actions";
import { getColor } from "@/components/helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DataPointVintagesPage({
  params,
}: {
  params: Promise<{ universe: string; id: string; date: string }>;
}) {
  const { universe, id, date } = await params;
  const seriesId = Number(id);
  const series = await getSeriesById(seriesId, {
    universe: universe as Universe,
  });
  const { metadata } = series;

  const vintages = await getDataPointVintages(metadata.xs_id, date);

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/udaman/${universe}/series/${seriesId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to series
        </Link>
      </div>

      <div>
        <h1 className="text-lg font-semibold">
          Data Point Vintages — {metadata.s_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Observation date: {date}
        </p>
      </div>

      <Table className="font-mono text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="text-end">Value</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Loader</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Pseudo History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vintages.length > 0 ? (
            vintages.map((v, i) => (
              <TableRow key={`vintage-${i}`} className={getColor(v.color)}>
                <TableCell className="text-end font-semibold">
                  {v.value != null
                    ? Number(v.value).toFixed(metadata.s_decimals)
                    : "-"}
                </TableCell>
                <TableCell>
                  {format(new Date(v.created_at), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  {v.updated_at
                    ? format(new Date(v.updated_at), "MMM d, yyyy HH:mm")
                    : "-"}
                </TableCell>
                <TableCell>{v.data_source_id}</TableCell>
                <TableCell>{v.current ? "Yes" : "No"}</TableCell>
                <TableCell>{v.pseudo_history ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No data points found for this date.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
