import Link from "next/link";
import type {
  MeasurementRef,
  SeriesAlias,
  SeriesMetadata,
} from "@catalog/types/shared";
import { numBool } from "@catalog/utils";
import { formatHst } from "@catalog/utils/time";

import { cn } from "@/lib/utils";

import { SAIndicator } from "../common";
import { AliasManager } from "../series/alias-manager";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";

type MetadataRow = {
  name: string;
  value: React.ReactNode;
};

function renderValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value) && value.length === 0) return "-";
  return value;
}

export function MetaDataTable({
  metadata,
  universe,
  isDev = false,
}: {
  metadata: SeriesMetadata & {
    aliases: SeriesAlias[];
    measurement: MeasurementRef[];
  };
  universe: string;
  isDev?: boolean;
}) {
  // Build universe list: current series + aliases, bold the primary
  const currentIsPrimary = metadata.s_id === metadata.xs_primary_series_id;
  const universeEntries: { name: string; isPrimary: boolean }[] = [
    { name: metadata.s_universe, isPrimary: currentIsPrimary },
    ...metadata.aliases.map((a) => ({
      name: a.universe,
      isPrimary: a.isPrimary,
    })),
  ];
  // Deduplicate (shouldn't happen, but just in case) and sort primary first
  const seen = new Set<string>();
  const uniqueUniverses = universeEntries.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
  uniqueUniverses.sort((a, b) =>
    a.isPrimary ? -1 : b.isPrimary ? 1 : a.name.localeCompare(b.name),
  );

  /** Link a value to its catalog record's detail page, when both exist. */
  const catalogLink = (
    path: "units" | "geographies" | "source-details",
    id: number | null,
    label: string | null,
  ) =>
    id != null && label ? (
      <Link
        href={`/udaman/${universe}/catalog/${path}/${id}`}
        className="hover:underline"
      >
        {label}
      </Link>
    ) : (
      label
    );

  const rows: MetadataRow[] = [
    {
      name: "Universe",
      value: (
        <span>
          {uniqueUniverses.map((u, i) => (
            <span key={u.name}>
              {i > 0 && ", "}
              <span className={u.isPrimary ? "font-bold" : ""}>{u.name}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      name: "Aliases",
      value: (
        <AliasManager
          seriesId={metadata.s_id}
          currentUniverse={metadata.s_universe}
          isPrimary={metadata.s_id === metadata.xs_primary_series_id}
          aliases={metadata.aliases}
        />
      ),
    },
    {
      name: "Measurements",
      value: metadata.measurement.map((m) => (
        <Link
          key={`${m.id}`}
          href={`/udaman/${universe}/catalog/measurements/${m.id}`}
          className="block hover:underline"
        >
          {m.prefix}
        </Link>
      )),
    },
    { name: "Description", value: metadata.s_description },
    { name: "Aremos Desc.", value: metadata.s_name },
    {
      name: "Units",
      value: catalogLink(
        "units",
        metadata.s_unit_id,
        metadata.u_long_label || metadata.u_short_label
          ? `${metadata.u_long_label ?? "-"} (${metadata.u_short_label ?? "-"})`
          : null,
      ),
    },
    {
      name: "Geography",
      value: catalogLink(
        "geographies",
        metadata.s_geography_id,
        metadata.geo_display_name,
      ),
    },
    { name: "Decimals", value: metadata.s_decimals },
    {
      name: "Seasonal Adjustment",
      value: <SAIndicator sa={metadata.xs_seasonal_adjustment} />,
    },
    {
      name: "Source",
      value: (
        <a className="hover:underline" href={metadata.source_link ?? "#"}>
          {metadata.source_description}
        </a>
      ),
    },
    {
      name: "Source Details",
      value: catalogLink(
        "source-details",
        metadata.s_source_detail_id,
        metadata.source_detail_description,
      ),
    },
    {
      name: "Restricted",
      value: numBool(metadata.xs_restricted) ? "True" : "False",
    },
    {
      name: "Quarantined",
      value: numBool(metadata.xs_quarantined) ? "True" : "False",
    },
    {
      name: "Created at",
      value: formatHst(metadata.s_created_at, "EEE MMM dd yyyy"),
    },
    {
      name: "Updated at",
      value: formatHst(metadata.s_updated_at, "EEE MMM dd yyyy"),
    },
    ...(isDev ? [{ name: "XID (devs only)", value: metadata.xs_id }] : []),
    { name: "Internal ID", value: metadata.s_id },
  ];

  return (
    <div className="p-1">
      <h2 className="mb-2 text-lg font-semibold tracking-tight">
        Series Metadata
      </h2>
      {/* table-fixed + wrapping cells: the shared TableCell is nowrap, which
          under auto layout lets one long value stretch the table past its
          column. */}
      <Table className="table-fixed cursor-default">
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.name}
              className={cn("py-1", index % 2 === 0 ? "bg-muted" : "bg-none")}
            >
              <TableCell className="w-32 font-medium whitespace-normal">
                {row.name}
              </TableCell>
              <TableCell className="max-w-none wrap-break-word whitespace-normal">
                {renderValue(row.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
