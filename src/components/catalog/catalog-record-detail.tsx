import Link from "next/link";
import type {
  SeriesCatalogRef,
  SeriesRefRow,
} from "@catalog/collections/series-collection";
import type { SeasonalAdjustment } from "@catalog/types/shared";

import { SeriesRefPager } from "@/components/catalog/series-ref-pager";
import { SAIndicator } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DetailField = { label: string; value: React.ReactNode };

/**
 * Detail page shell for the small catalog records a series points at
 * (unit / geography / source detail): heading + edit control, the record's
 * fields, then every series that references it. `refKind` drops the series
 * column that would just repeat this record on every row.
 */
export function CatalogRecordDetail({
  kind,
  title,
  subtitle,
  editButton,
  fields,
  aside,
  refKind,
  series,
}: {
  kind: string;
  title: string;
  subtitle?: string | null;
  editButton?: React.ReactNode;
  fields: DetailField[];
  /** Optional panel to the right of the fields (stacks below on narrow). */
  aside?: React.ReactNode;
  refKind: SeriesCatalogRef;
  series: { rows: SeriesRefRow[]; total: number; page: number; limit: number };
}) {
  const { rows, total, page, limit } = series;
  const showGeo = refKind !== "geography";
  const showUnit = refKind !== "unit";
  const showSourceDetail = refKind !== "sourceDetail";
  const colCount = 4 + +showGeo + +showUnit + +showSourceDetail;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {kind}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{title}</h1>
          {editButton}
        </div>
        {subtitle && (
          <p className="text-muted-foreground text-lg">{subtitle}</p>
        )}
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <dl className="grid max-w-xl grid-cols-[max-content_1fr] content-start gap-x-6 gap-y-1.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-medium wrap-break-word">
                {f.value === null || f.value === undefined || f.value === ""
                  ? "-"
                  : f.value}
              </dd>
            </div>
          ))}
        </dl>
        {aside && <div className="min-w-0 md:ml-auto">{aside}</div>}
      </div>

      <section className="min-w-0">
        <h2 className="mb-2 text-sm font-semibold">
          Series ({total.toLocaleString()})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Series</TableHead>
              <TableHead>Data Portal Name</TableHead>
              <TableHead>Freq</TableHead>
              {showGeo && <TableHead>Geo</TableHead>}
              {showUnit && <TableHead>Units</TableHead>}
              {showSourceDetail && <TableHead>Source Detail</TableHead>}
              <TableHead>SA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-muted-foreground h-24 text-center"
                >
                  No series reference this {kind.toLowerCase()}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id} className="odd:bg-muted">
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/udaman/${s.universe.toLowerCase()}/series/${s.id}`}
                      className="text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="max-w-64"
                    title={s.dataPortalName ?? ""}
                  >
                    {s.dataPortalName ?? "-"}
                  </TableCell>
                  <TableCell>{s.frequency ?? "-"}</TableCell>
                  {showGeo && <TableCell>{s.geoHandle ?? "-"}</TableCell>}
                  {showUnit && <TableCell>{s.unitShortLabel ?? "-"}</TableCell>}
                  {showSourceDetail && (
                    <TableCell
                      className="max-w-48"
                      title={s.sourceDetailDescription ?? ""}
                    >
                      {s.sourceDetailDescription ?? "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <SAIndicator
                      sa={s.seasonalAdjustment as SeasonalAdjustment | null}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {total > 0 && (
          <SeriesRefPager page={page} limit={limit} total={total} />
        )}
      </section>
    </div>
  );
}
