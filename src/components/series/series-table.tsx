"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DataPoint } from "@catalog/types/shared";
import { formatLevel } from "@catalog/utils/format";
import { dpAgeCode, freqDate, isoDate } from "@catalog/utils/time";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
} from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getColor } from "../helpers";
import { DataPointTooltip } from "./data-point-hover-card";
import { SERIES_TABLE_TOOLS_SLOT_ID } from "./loader-action-history";
import { useSetHoveredDate } from "./series-data-section";

/** Row pitch (cell + border + border-spacing) until the real one is measured. */
const DEFAULT_ROW_HEIGHT = 33;
/** Rows rendered beyond each edge of the viewport. */
const OVERSCAN = 20;

const isNumber = (val: unknown): val is number => {
  if (val === null || val === undefined) return false;
  if (typeof val !== "number") return false;
  if (isNaN(val)) return false;
  return true;
};

const dpColor = (n: number) => {
  if (n === 0) return "text-slate-700";
  if (n > 0) return "text-green-800";
  return "text-red-800";
};

const levelText = (n: number | null, decimals: number) =>
  isNumber(n) ? formatLevel(n, decimals) : "-";

const percText = (n: number | null, decimals: number) =>
  isNumber(n) ? `${n.toFixed(decimals)}%` : "-";

const FormattedCell = ({ n, text }: { n: number | null; text: string }) => {
  if (!isNumber(n)) return "-";
  return (
    <span className={cn("w-full text-end text-xs text-slate-600", dpColor(n))}>
      {text}
    </span>
  );
};

type TableOptions = {
  decimals: number;
  showLoaderCol: boolean;
  xseriesId: number;
  universe: string;
  seriesId: number;
  frequency?: string | null;
};

/**
 * The text each column shows for a data point. Shared by the cell renderers
 * and by the column-width pass, so the two cannot drift apart.
 */
const columnText = (options: TableOptions) => {
  const { decimals, frequency } = options;
  return {
    date: (d: DataPoint) => String(freqDate(d.date, frequency)),
    value: (d: DataPoint) => levelText(d.value as number | null, decimals),
    yoy: (d: DataPoint) => percText(d.yoy as number | null, decimals),
    ytd: (d: DataPoint) => percText(d.ytd as number | null, decimals),
    lvl_change: (d: DataPoint) =>
      levelText(d.lvl_change as number | null, decimals),
    updated_at: (d: DataPoint) =>
      String(dpAgeCode(d.updated_at, Boolean(d.pseudo_history)) ?? ""),
    loader_id: (d: DataPoint) => String(d.loader_id ?? ""),
  } satisfies Record<string, (d: DataPoint) => string>;
};

const DataRow = memo(function DataRow({
  row,
  index,
  highlighted,
  setHoveredDate,
}: {
  row: Row<DataPoint>;
  index: number;
  highlighted: boolean;
  setHoveredDate: (date: Date | null) => void;
}) {
  return (
    <TableRow
      data-index={index}
      data-state={row.getIsSelected() && "selected"}
      className={cn("group", index % 2 === 0 ? "bg-muted" : "bg-none")}
      onMouseEnter={() => setHoveredDate(row.getValue("date"))}
      onMouseLeave={() => setHoveredDate(null)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "group-hover:bg-muted cursor-default border-b text-end",
            highlighted ? "bg-amber-100" : "bg-white",
            cell.column.id === "value" && getColor(cell.row.getValue("color")),
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
});

/**
 * `2026`, `2026-07` or `2026-07-05` → the last calendar day the entry covers,
 * as an ISO date. Single-digit months and days are accepted. Null if the
 * text is not a date in one of those shapes.
 */
const parseJumpDate = (input: string) => {
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(input.trim());
  if (!match) return null;
  const year = match[1];
  const month = match[2]?.padStart(2, "0");
  const day = match[3]?.padStart(2, "0");
  if (month && (month < "01" || month > "12")) return null;
  if (day && (day < "01" || day > "31")) return null;
  const period = [year, month, day].filter(Boolean).join("-");
  // "-31" sorts at or after every real day of any month, which is all the
  // string comparison against row dates needs.
  const end = `${year}-${month ?? "12"}-${day ?? "31"}`;
  return { period, end };
};

/**
 * Find-in-page cannot see rows that are not rendered, so this is how a user
 * reaches a date. `onJump` scrolls to the matching row and returns a note
 * to show when it could not land inside the requested period.
 */
const JumpToDate = ({
  onJump,
}: {
  onJump: (period: string, end: string) => string | null;
}) => {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseJumpDate(value);
        setInvalid(!parsed);
        setNote(
          parsed
            ? onJump(parsed.period, parsed.end)
            : "Use YYYY, YYYY-MM or YYYY-MM-DD",
        );
      }}
    >
      {note && (
        <span
          role="status"
          className={cn(
            "text-xs",
            invalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {note}
        </span>
      )}
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
          setNote(null);
        }}
        aria-label="Jump to date"
        aria-invalid={invalid}
        placeholder="Jump to date: YYYY-MM-DD"
        title="Enter a year, year-month or full date, then press Enter"
        inputMode="numeric"
        autoComplete="off"
        className="h-7 w-52 font-mono text-xs md:text-xs"
      />
    </form>
  );
};

/** Stands in for the rows scrolled out of view above or below. */
const SpacerRow = ({ height, colSpan }: { height: number; colSpan: number }) =>
  height > 0 ? (
    <tr aria-hidden>
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  ) : null;

export const SeriesDataTable = ({
  data,
  options,
}: {
  data: DataPoint[];
  options: TableOptions;
}) => {
  const setHoveredDate = useSetHoveredDate();
  const { decimals, showLoaderCol, xseriesId, universe, seriesId, frequency } =
    options;

  const text = useMemo(
    () =>
      columnText({
        decimals,
        showLoaderCol,
        xseriesId,
        universe,
        seriesId,
        frequency,
      }),
    [decimals, showLoaderCol, xseriesId, universe, seriesId, frequency],
  );

  const columns = useMemo<ColumnDef<DataPoint>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => text.date(row.original),
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => (
          <DataPointTooltip
            value={text.value(row.original)}
            xseriesId={xseriesId}
            date={isoDate(row.original.date)}
            universe={universe}
            seriesId={seriesId}
            decimals={decimals}
          />
        ),
      },
      {
        accessorKey: "yoy",
        header: "YOY",
        meta: {
          className: "text-primary/60 w-full text-end text-xs",
        },
        cell: ({ row }) => (
          <FormattedCell
            n={row.original.yoy as number | null}
            text={text.yoy(row.original)}
          />
        ),
      },
      {
        accessorKey: "ytd",
        header: "YTD",
        cell: ({ row }) => (
          <FormattedCell
            n={row.original.ytd as number | null}
            text={text.ytd(row.original)}
          />
        ),
      },
      {
        accessorKey: "lvl_change",
        header: "LVL",
        cell: ({ row }) => (
          <FormattedCell
            n={row.original.lvl_change as number | null}
            text={text.lvl_change(row.original)}
          />
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Age",
        cell: ({ row }) => text.updated_at(row.original),
      },
      {
        accessorKey: "loader_id",
        header: "Loader",
      },
      {
        accessorKey: "pseudo_history",
        header: "pseudo_history",
      },
      {
        accessorKey: "color",
        header: "color",
      },
    ],
    [text, decimals, xseriesId, universe, seriesId],
  );

  // Only the rows near the viewport are in the DOM, so the browser can no
  // longer size columns from the whole series: left alone they would shift
  // as wider or narrower values scroll in. The table is monospace, so the
  // longest string in each column (in `ch`) reproduces the width the full
  // table would have settled on.
  const columnChars = useMemo(() => {
    const chars: Record<string, number> = {};
    for (const [id, format] of Object.entries(text)) {
      let max = 0;
      for (const d of data) {
        const len = format(d).length;
        if (len > max) max = len;
      }
      chars[id] = max;
    }
    return chars;
  }, [data, text]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: {
        pseudo_history: false,
        color: false,
        loader_id: showLoaderCol,
      },
    },
  });
  const rows = table.getRowModel().rows;
  const colSpan = table.getVisibleLeafColumns().length;

  // The page itself scrolls (there is no inner scroll box), so rows are
  // virtualized against the window. `scrollMargin` is where the body starts
  // in the document; it moves whenever something above the table resizes.
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    scrollMargin,
    // Lets the server (and the first client render) emit the top of the
    // table instead of an empty body.
    initialRect: { width: 0, height: 1000 },
  });

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      setScrollMargin(
        Math.round(body.getBoundingClientRect().top + window.scrollY),
      );
      // Row pitch = distance between two consecutive rows, which (unlike a
      // row's own height) includes the table's border-spacing.
      const [first, second] =
        body.querySelectorAll<HTMLElement>("tr[data-index]");
      if (first && second) {
        const pitch =
          second.getBoundingClientRect().top -
          first.getBoundingClientRect().top;
        if (pitch > 0) setRowHeight(pitch);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  // Index of the row last jumped to; tinted briefly so it is easy to spot.
  const [jumpedIndex, setJumpedIndex] = useState<number | null>(null);
  useEffect(() => {
    if (jumpedIndex === null) return;
    const timer = setTimeout(() => setJumpedIndex(null), 2500);
    return () => clearTimeout(timer);
  }, [jumpedIndex]);

  const jumpToDate = useCallback(
    (period: string, end: string) => {
      // Latest point on or before the end of the requested period, so a year
      // or month lands on its last point. Makes no assumption about row
      // order. If the request predates the series, fall back to its start.
      let target = -1;
      let targetDate = "";
      let earliest = -1;
      let earliestDate = "";
      rows.forEach((row, i) => {
        const date = isoDate(row.original.date);
        if (date <= end && date > targetDate) {
          target = i;
          targetDate = date;
        }
        if (earliest === -1 || date < earliestDate) {
          earliest = i;
          earliestDate = date;
        }
      });
      if (target === -1) {
        target = earliest;
        targetDate = earliestDate;
      }
      if (target === -1) return "No data";
      virtualizer.scrollToIndex(target, { align: "center" });
      setJumpedIndex(target);
      return targetDate.startsWith(period)
        ? null
        : `No point in ${period}, showing ${targetDate}`;
    },
    [rows, virtualizer],
  );

  // The jump input is shown on the "Loader History" row above the table when
  // that row is on the page, and directly above the table otherwise.
  const [toolsSlot, setToolsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolsSlot(document.getElementById(SERIES_TABLE_TOOLS_SLOT_ID));
  }, []);

  const virtualRows = virtualizer.getVirtualItems();
  const first = virtualRows[0];
  const last = virtualRows[virtualRows.length - 1];
  const padTop = first ? first.start - scrollMargin : 0;
  const padBottom = last
    ? virtualizer.getTotalSize() - (last.end - scrollMargin)
    : 0;

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div>
        {rows.length > 0 &&
          (toolsSlot ? (
            createPortal(<JumpToDate onJump={jumpToDate} />, toolsSlot)
          ) : (
            <div className="mb-1 flex justify-end px-1">
              <JumpToDate onJump={jumpToDate} />
            </div>
          ))}
        <Table className="border-separate border-spacing-1 font-mono text-gray-800">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-end"
                    style={{
                      // + 1rem for the cells' horizontal padding
                      minWidth: `calc(${columnChars[header.column.id] ?? 0}ch + 1rem)`,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody ref={bodyRef}>
            {rows.length ? (
              <>
                <SpacerRow height={padTop} colSpan={colSpan} />
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <DataRow
                      key={row.id}
                      row={row}
                      index={virtualRow.index}
                      highlighted={virtualRow.index === jumpedIndex}
                      setHoveredDate={setHoveredDate}
                    />
                  );
                })}
                <SpacerRow height={padBottom} colSpan={colSpan} />
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-5 text-end">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
        </Table>
      </div>
    </TooltipProvider>
  );
};
