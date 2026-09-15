"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  getPerfData,
  type JobRun,
  type NightlyRun,
  type PerfData,
} from "@/actions/perf";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/*
 * Register: statistical-yearbook table anatomy with a terminal's colour
 * logic. Rules carry the hierarchy — a 2px rule opens a table or the
 * page, hairlines separate rows and figures, nothing is boxed. Figures
 * are monospace and tabular. Colour appears only where it encodes: a
 * series, or the one status state (failed). No radius, no shadow, no
 * fill behind anything.
 */

// ─── Palette (encoding only) ─────────────────────────────────────────
// Categorical slots in fixed order, never cycled. Light/dark pairs pass
// the CVD-separation and lightness checks against the app's surfaces.
const SLOT = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
] as const;
const NEUTRAL = { light: "#898781", dark: "#898781" } as const;
/** The one status colour. Always accompanied by a glyph and a word. */
const CRITICAL = "#d03b3b";

const PERIODS = [7, 30, 90] as const;

/** Scheduled and heavy jobs, in the order they're shown. */
const JOBS: { name: string; label: string }[] = [
  { name: "reload.batch", label: "Nightly batch reload" },
  { name: "public.update", label: "Public data sweep" },
  { name: "reload.bls", label: "BLS reload" },
  { name: "reload.bea", label: "BEA reload" },
  { name: "reload.sa", label: "SA reload" },
  { name: "reload.tour_ocup", label: "Tour occupancy reload" },
  { name: "reload.vap_hi", label: "VAP HI reload" },
  { name: "reload.uic", label: "UIC reload" },
  { name: "admin.dependency-reset", label: "Dependency reset" },
  { name: "reload.targeted", label: "Targeted reload (manual)" },
  { name: "reload-job.process", label: "Reload job" },
  { name: "upload.dvw", label: "DVW upload" },
  { name: "upload.dbedt", label: "DBEDT upload" },
  { name: "tsd.export", label: "TSD export" },
  { name: "export.kauai", label: "Kauai export" },
  { name: "download.file", label: "Scheduled download" },
];

const QUEUES = ["default", "heavy", "critical", "light"] as const;

// ─── Formatting ──────────────────────────────────────────────────────

const HST = "Pacific/Honolulu";

function fmtDur(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

function fmtDate(t: number | string): string {
  return new Date(t).toLocaleDateString("en-US", {
    timeZone: HST,
    month: "short",
    day: "numeric",
  });
}

/** 2026-09-03 19:44 — ISO-ish, monospace-friendly, HST. */
function fmtStamp(t: number | string): string {
  const d = new Date(t);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function hstDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: HST });
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const n = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("en-US");

// ─── Typographic primitives ──────────────────────────────────────────

/** Small-caps label: section numbers, table heads, tile captions. */
function Cap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status word with its glyph. Colour never appears without both. */
function Failed({ count, word = "failed" }: { count: number; word?: string }) {
  if (count === 0) return null;
  return (
    <span className="font-mono" style={{ color: CRITICAL }}>
      ▲ {count} {word}
    </span>
  );
}

/** Numbered section: rule, number + title on one line, description under. */
function Section({
  no,
  title,
  description,
  children,
}: {
  no: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-foreground border-t-2 pt-3">
      <div className="mb-4 flex items-baseline gap-4">
        <Cap className="text-foreground">{no}</Cap>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Figure: hairline above, caption row, plot. Sits directly on the page. */
function Figure({
  no,
  title,
  meta,
  children,
}: {
  no: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="bg-background p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Cap>Fig. {no}</Cap>
        <span className="text-sm font-medium">{title}</span>
        {meta && (
          <span className="text-muted-foreground ml-auto font-mono text-[11px] tabular-nums">
            {meta}
          </span>
        )}
      </figcaption>
      {children}
    </figure>
  );
}

/** Legend: square swatches, monospace labels, no box. */
function Legend({
  items,
}: {
  items: { key: string; label: string }[];
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5 font-mono text-[11px]">
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ background: `var(--color-${it.key})` }}
            aria-hidden
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// Yearbook table: 2px rule on top, 1px under the head, hairlines between
// rows, 2px rule to close. Numbers right-aligned, monospace.
function Tbl({
  no,
  title,
  cols,
  children,
  empty,
  rows,
}: {
  no: string;
  title: string;
  cols: { label: string; num?: boolean; className?: string }[];
  children: ReactNode;
  empty: string;
  rows: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <Cap>Table {no}</Cap>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <table className="border-foreground w-full border-t-2 border-b-2 border-collapse text-xs">
        <thead>
          <tr className="border-foreground border-b">
            {cols.map((c) => (
              <th
                key={c.label}
                className={cn(
                  "py-1.5 pr-3 text-left align-bottom font-normal last:pr-0",
                  c.num && "text-right",
                  c.className,
                )}
              >
                <Cap>{c.label}</Cap>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-border [&>tr]:border-b [&>tr:last-child]:border-b-0">
          {rows === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="text-muted-foreground py-2 font-mono text-[11px]"
              >
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function Td({
  children,
  num,
  className,
  title,
}: {
  children: ReactNode;
  num?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn(
        "py-1.5 pr-3 align-top last:pr-0",
        num && "text-right font-mono tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

const tooltipClass =
  "rounded-none border-foreground/40 shadow-none font-mono tabular-nums";

// ─── Charts ──────────────────────────────────────────────────────────

const axisProps = { tickLine: false, axisLine: false } as const;

/** Only failed runs get a mark: ink where it means something. */
function FailDot(props: {
  cx?: number;
  cy?: number;
  payload?: { status?: string };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.status !== "failed") return null;
  return (
    <path
      d={`M${cx} ${cy - 5} L${cx + 5} ${cy + 4} L${cx - 5} ${cy + 4} Z`}
      fill={CRITICAL}
      stroke="var(--background)"
      strokeWidth={1.5}
    />
  );
}

function HoverDot(props: { cx?: number; cy?: number; payload?: { status?: string } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={payload?.status === "failed" ? CRITICAL : "var(--color-run)"}
      stroke="var(--background)"
      strokeWidth={2}
    />
  );
}

const runConfig = {
  run: { label: "Duration", theme: SLOT[0] },
} satisfies ChartConfig;

function JobDurationFigure({
  no,
  label,
  runs,
}: {
  no: string;
  label: string;
  runs: JobRun[];
}) {
  const data = useMemo(
    () =>
      [...runs]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((r) => ({
          t: Date.parse(r.at),
          run: r.runMs,
          status: r.status,
          waitMs: r.waitMs,
        })),
    [runs],
  );
  const failed = runs.filter((r) => r.status === "failed").length;
  const last = data[data.length - 1];
  const med = median(data.map((d) => d.run));

  return (
    <Figure
      no={no}
      title={label}
      meta={
        <>
          last {fmtDur(last?.run)} · med {fmtDur(med)} · n {data.length}
          {failed > 0 && (
            <>
              {" · "}
              <Failed count={failed} />
            </>
          )}
        </>
      }
    >
      <ChartContainer config={runConfig} className="h-[150px] w-full font-mono text-[10px]">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtDate}
            minTickGap={40}
            {...axisProps}
          />
          <YAxis tickFormatter={(v: number) => fmtDur(v)} width={52} {...axisProps} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className={tooltipClass}
                labelFormatter={(_, p) => (p?.[0] ? fmtStamp(p[0].payload.t) : "")}
                formatter={(v, _name, item) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {item.payload.status === "failed" ? "failed after" : "duration"}
                    </span>
                    <span>
                      {fmtDur(Number(v))}
                      {item.payload.waitMs != null && ` · waited ${fmtDur(item.payload.waitMs)}`}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Line
            dataKey="run"
            type="linear"
            stroke="var(--color-run)"
            strokeWidth={1.5}
            dot={<FailDot />}
            activeDot={<HoverDot />}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </Figure>
  );
}

const DEPTH_KEYS = ["d0", "d1", "d2", "d3", "d4", "d5"] as const;
const nightlyConfig = {
  d0: { label: "depth 0", theme: SLOT[0] },
  d1: { label: "depth 1", theme: SLOT[1] },
  d2: { label: "depth 2", theme: SLOT[2] },
  d3: { label: "depth 3", theme: SLOT[3] },
  d4: { label: "depth 4", theme: SLOT[4] },
  d5: { label: "depth 5+", theme: NEUTRAL },
} satisfies ChartConfig;

function NightlyFigure({ nightly }: { nightly: NightlyRun[] }) {
  const rows = useMemo(
    () => [...nightly].sort((a, b) => a.at.localeCompare(b.at)),
    [nightly],
  );
  const data = useMemo(
    () =>
      rows.map((r) => {
        const byDepth: Record<(typeof DEPTH_KEYS)[number], number> = {
          d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0,
        };
        for (const d of r.perDepth) {
          byDepth[DEPTH_KEYS[Math.min(Math.max(d.depth, 0), 5)]] += d.seconds * 1000;
        }
        return { label: fmtDate(r.at), ...byDepth };
      }),
    [rows],
  );
  const usedKeys = DEPTH_KEYS.filter((k) => data.some((d) => d[k] > 0));

  return (
    <div className="bg-border grid gap-px lg:grid-cols-[3fr_2fr]">
      <Figure no="2.1" title="Nightly reload, seconds per depth level" meta={`${rows.length} nights`}>
        {data.length === 0 ? (
          <p className="text-muted-foreground font-mono text-[11px]">no nightly runs in period</p>
        ) : (
          <>
            <ChartContainer config={nightlyConfig} className="h-[220px] w-full font-mono text-[10px]">
              <BarChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }} barCategoryGap={3}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" minTickGap={24} {...axisProps} />
                <YAxis tickFormatter={(v: number) => fmtDur(v)} width={52} {...axisProps} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className={tooltipClass}
                      formatter={(v, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {nightlyConfig[name as keyof typeof nightlyConfig]?.label ?? String(name)}
                          </span>
                          <span>{fmtDur(Number(v))}</span>
                        </div>
                      )}
                    />
                  }
                />
                {usedKeys.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="night"
                    fill={`var(--color-${k})`}
                    stroke="var(--background)"
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            {usedKeys.length > 1 && (
              <Legend items={usedKeys.map((k) => ({ key: k, label: nightlyConfig[k].label }))} />
            )}
          </>
        )}
      </Figure>
      <div className="bg-background p-4">
        <Tbl
          no="2.1"
          title="Nightly runs"
          cols={[
            { label: "Night" },
            { label: "Duration", num: true },
            { label: "Lock wait", num: true },
            { label: "Series", num: true },
            { label: "Failed", num: true },
          ]}
          rows={rows.length}
          empty="no data"
        >
          {[...rows]
            .reverse()
            .slice(0, 12)
            .map((r) => (
              <tr key={r.at}>
                <Td className="font-mono">{fmtStamp(r.at)}</Td>
                <Td num>{fmtDur((r.elapsedSec ?? 0) * 1000)}</Td>
                <Td num>{fmtDur(r.lockWaitMs)}</Td>
                <Td num>
                  {n(r.reloaded)}
                  {r.total != null && `/${n(r.total)}`}
                </Td>
                <Td num>
                  {r.failed ? <Failed count={r.failed} word="" /> : "0"}
                </Td>
              </tr>
            ))}
        </Tbl>
      </div>
    </div>
  );
}

const queueConfig = {
  default: { label: "default", theme: SLOT[0] },
  heavy: { label: "heavy", theme: SLOT[1] },
  critical: { label: "critical", theme: SLOT[2] },
  light: { label: "light", theme: SLOT[3] },
} satisfies ChartConfig;

function QueueWaitFigure({ runs }: { runs: JobRun[] }) {
  const { data, table } = useMemo(() => {
    const byDay = new Map<string, Record<string, number[]>>();
    for (const r of runs) {
      if (r.waitMs == null || !QUEUES.includes(r.queue as (typeof QUEUES)[number])) continue;
      const day = hstDay(r.at);
      const bucket = byDay.get(day) ?? {};
      (bucket[r.queue] ??= []).push(r.waitMs);
      byDay.set(day, bucket);
    }
    const days = [...byDay.keys()].sort();
    const data = days.map((day) => {
      const row: Record<string, number | string> = { label: fmtDate(`${day}T12:00:00`) };
      for (const q of QUEUES) {
        const xs = byDay.get(day)?.[q];
        if (xs?.length) row[q] = Math.max(...xs);
      }
      return row;
    });
    const table = QUEUES.map((q) => {
      const xs = runs.filter((r) => r.queue === q && r.waitMs != null).map((r) => r.waitMs!);
      return { queue: q, jobs: xs.length, median: median(xs), max: xs.length ? Math.max(...xs) : null };
    });
    return { data, table };
  }, [runs]);

  return (
    <Figure no="3.1" title="Longest queue wait per day" meta="enqueue → pickup, max per day">
      <ChartContainer config={queueConfig} className="h-[200px] w-full font-mono text-[10px]">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" minTickGap={24} {...axisProps} />
          <YAxis tickFormatter={(v: number) => fmtDur(v)} width={52} {...axisProps} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className={tooltipClass}
                formatter={(v, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{String(name)}</span>
                    <span>{fmtDur(Number(v))}</span>
                  </div>
                )}
              />
            }
          />
          {QUEUES.map((q) => (
            <Line
              key={q}
              dataKey={q}
              type="linear"
              stroke={`var(--color-${q})`}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <Legend items={QUEUES.map((q) => ({ key: q, label: q }))} />
      <div className="mt-4">
        <Tbl
          no="3.1"
          title="Queue wait, period"
          cols={[
            { label: "Queue" },
            { label: "Jobs", num: true },
            { label: "Median", num: true },
            { label: "Longest", num: true },
          ]}
          rows={table.length}
          empty="no data"
        >
          {table.map((r) => (
            <tr key={r.queue}>
              <Td className="font-mono">{r.queue}</Td>
              <Td num>{n(r.jobs)}</Td>
              <Td num>{fmtDur(r.median)}</Td>
              <Td num>{fmtDur(r.max)}</Td>
            </tr>
          ))}
        </Tbl>
      </div>
    </Figure>
  );
}

function MemoryFigure({ runs }: { runs: JobRun[] }) {
  const { data, workers, config } = useMemo(() => {
    const names = [...new Set(runs.map((r) => r.worker ?? "worker"))].sort().slice(0, 4);
    const keyOf = (w: string) => `w${names.indexOf(w)}`;
    const config: ChartConfig = {};
    names.forEach((w, i) => {
      config[keyOf(w)] = { label: w, theme: SLOT[i] };
    });
    const data = [...runs]
      .filter((r) => r.rssMB != null && names.includes(r.worker ?? "worker"))
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => ({
        t: Date.parse(r.at),
        job: r.name,
        [keyOf(r.worker ?? "worker")]: r.rssMB,
      }));
    return { data, workers: names, config };
  }, [runs]);

  const summary = workers.map((w) => {
    const rs = runs.filter((r) => (r.worker ?? "worker") === w && r.rssMB != null);
    const last = rs[0]; // newest first from the action
    const peak = rs.length ? Math.max(...rs.map((r) => r.rssMB!)) : null;
    return { worker: w, last: last?.rssMB ?? null, peak, at: last?.at ?? null };
  });

  return (
    <Figure no="3.2" title="Worker RSS after each job" meta="MB · host 8 192">
      <ChartContainer config={config} className="h-[200px] w-full font-mono text-[10px]">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtDate}
            minTickGap={40}
            {...axisProps}
          />
          <YAxis tickFormatter={(v: number) => n(Math.round(v))} width={52} {...axisProps} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className={tooltipClass}
                labelFormatter={(_, p) =>
                  p?.[0] ? `${fmtStamp(p[0].payload.t)} · ${p[0].payload.job}` : ""
                }
                formatter={(v, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {String(config[String(name)]?.label ?? name)}
                    </span>
                    <span>{n(Number(v))} MB</span>
                  </div>
                )}
              />
            }
          />
          {workers.map((w, i) => (
            <Line
              key={w}
              dataKey={`w${i}`}
              type="stepAfter"
              stroke={`var(--color-w${i})`}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      {workers.length > 1 && (
        <Legend items={workers.map((w, i) => ({ key: `w${i}`, label: w }))} />
      )}
      <div className="mt-4">
        <Tbl
          no="3.2"
          title="Worker memory"
          cols={[
            { label: "Worker" },
            { label: "Latest MB", num: true },
            { label: "Peak MB", num: true },
            { label: "Sampled", num: true },
          ]}
          rows={summary.length}
          empty="no data"
        >
          {summary.map((r) => (
            <tr key={r.worker}>
              <Td className="font-mono">{r.worker}</Td>
              <Td num>{n(r.last)}</Td>
              <Td num>{n(r.peak)}</Td>
              <Td num>{r.at ? fmtStamp(r.at) : "—"}</Td>
            </tr>
          ))}
        </Tbl>
      </div>
    </Figure>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  detail,
  alert,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <Cap>{label}</Cap>
      <div
        className="mt-1 font-mono text-2xl tabular-nums"
        style={alert ? { color: CRITICAL } : undefined}
      >
        {alert && <span aria-label="needs attention">▲ </span>}
        {value}
      </div>
      {detail && (
        <div className="text-muted-foreground mt-1 font-mono text-[11px] tabular-nums">
          {detail}
        </div>
      )}
    </div>
  );
}

export default function PerfPanel({
  initialData,
  initialDays,
}: {
  initialData: PerfData;
  initialDays: number;
}) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState(initialDays);
  const [isPending, startTransition] = useTransition();

  function changePeriod(d: number) {
    setDays(d);
    startTransition(async () => {
      setData(await getPerfData(d));
    });
  }

  const runsByName = useMemo(() => {
    const m = new Map<string, JobRun[]>();
    for (const r of data.jobRuns) (m.get(r.name) ?? m.set(r.name, []).get(r.name)!).push(r);
    return m;
  }, [data.jobRuns]);

  const lastNightly = data.nightly[0];
  const failedRuns = data.jobRuns.filter((r) => r.status === "failed");
  const lastUheroSweep = data.sweeps.find((s) => s.universe === "UHERO");
  const jobFigures = JOBS.filter((j) => (runsByName.get(j.name)?.length ?? 0) > 0);
  const otherNames = [...runsByName.keys()].filter((j) => !JOBS.some((x) => x.name === j));

  const seriesLink = (id: number | null, name: string | null, fallback: string) =>
    id != null ? (
      <Link href={`/udaman/UHERO/series/${id}`} className="underline-offset-2 hover:underline">
        {name ?? `#${id}`}
      </Link>
    ) : (
      fallback
    );

  return (
    <div className="space-y-8">
      {/* Controls: period as inverted mono toggles, no rounding */}
      <div className="border-foreground flex items-center gap-4 border-t-2 pt-2 font-mono text-[11px]">
        <Cap>Period</Cap>
        <div className="flex">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePeriod(p)}
              disabled={isPending}
              className={cn(
                "border-foreground border px-2 py-0.5 tabular-nums not-first:border-l-0",
                days === p ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {p}d
            </button>
          ))}
        </div>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span className="text-muted-foreground ml-auto tabular-nums">
          as of {fmtStamp(data.generatedAt)} HST
        </span>
      </div>

      {/* Headline figures: one row, vertical hairlines, no boxes */}
      <div className="divide-border grid divide-x sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Last nightly"
          value={lastNightly ? fmtDur((lastNightly.elapsedSec ?? 0) * 1000) : "—"}
          detail={
            lastNightly
              ? `${fmtStamp(lastNightly.at)} · lock ${fmtDur(lastNightly.lockWaitMs)}`
              : "no run recorded"
          }
        />
        <Tile
          label="Last UHERO sweep"
          value={lastUheroSweep ? fmtDur(lastUheroSweep.elapsedSec * 1000) : "—"}
          detail={
            lastUheroSweep
              ? `${lastUheroSweep.mode} · ${n(lastUheroSweep.updated + lastUheroSweep.inserted)} rows`
              : "no sweep recorded"
          }
        />
        <Tile
          label={`Failed jobs ${days}d`}
          value={String(failedRuns.length)}
          detail={failedRuns[0] ? `${failedRuns[0].name} ${fmtStamp(failedRuns[0].at)}` : "none"}
          alert={failedRuns.length > 0}
        />
        <Tile
          label="Loaders erroring 24h"
          value={String(data.loaderErrorCount)}
          detail="enabled, last_error_at < 1d"
          alert={data.loaderErrorCount > 0}
        />
        <Tile
          label="Downloads stale 24h"
          value={String(data.staleDownloadCount)}
          detail="url set · not frozen · no 200 in 1d"
          alert={data.staleDownloadCount > 0}
        />
      </div>

      <Section
        no="1"
        title="Job duration"
        description="Run time per job from the worker's completion records. Own scale per figure; ▲ marks a failed run."
      >
        {jobFigures.length === 0 ? (
          <p className="text-muted-foreground font-mono text-[11px]">
            no job records yet — they appear once the worker has finished a job on this build
          </p>
        ) : (
          <div className="bg-border grid gap-px md:grid-cols-2 xl:grid-cols-3">
            {jobFigures.map((j, i) => (
              <JobDurationFigure
                key={j.name}
                no={`1.${i + 1}`}
                label={j.label}
                runs={runsByName.get(j.name)!}
              />
            ))}
          </div>
        )}
        {otherNames.length > 0 && (
          <p className="text-muted-foreground mt-3 font-mono text-[11px]">
            also recorded, not charted:{" "}
            {otherNames.map((x) => `${x} ×${runsByName.get(x)!.length}`).join(", ")}
          </p>
        )}
      </Section>

      <Section no="2" title="Nightly reload" description="Where the night goes, level by level.">
        <NightlyFigure nightly={data.nightly} />
      </Section>

      <Section
        no="3"
        title="Queues and memory"
        description="Whether jobs wait on each other, and whether the worker's heap comes back down between them."
      >
        <div className="bg-border grid gap-px xl:grid-cols-2">
          <QueueWaitFigure runs={data.jobRuns} />
          <MemoryFigure runs={data.jobRuns} />
        </div>
      </Section>

      <Section no="4" title="Tables">
        <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
          <Tbl
            no="4.1"
            title="Public sweeps, latest 15"
            cols={[
              { label: "When" },
              { label: "Universe" },
              { label: "Mode" },
              { label: "Duration", num: true },
              { label: "Upd / Ins / Del", num: true },
              { label: "Skipped", num: true },
            ]}
            rows={data.sweeps.length}
            empty="no data"
          >
            {data.sweeps.slice(0, 15).map((s, i) => (
              <tr key={`${s.at}-${s.universe}-${i}`}>
                <Td className="font-mono whitespace-nowrap">{fmtStamp(s.at)}</Td>
                <Td className="font-mono">{s.universe}</Td>
                <Td className="font-mono">{s.mode}</Td>
                <Td num>{fmtDur(s.elapsedSec * 1000)}</Td>
                <Td num>{`${n(s.updated)} / ${n(s.inserted)} / ${n(s.deleted)}`}</Td>
                <Td num>{n(s.skipped)}</Td>
              </tr>
            ))}
          </Tbl>

          <Tbl
            no="4.2"
            title="Failed jobs, latest 15"
            cols={[{ label: "When" }, { label: "Job" }, { label: "Queue" }, { label: "Error" }]}
            rows={failedRuns.length}
            empty="none in period"
          >
            {failedRuns.slice(0, 15).map((r, i) => (
              <tr key={`${r.at}-${i}`}>
                <Td className="font-mono whitespace-nowrap">{fmtStamp(r.at)}</Td>
                <Td className="font-mono">{r.name}</Td>
                <Td className="font-mono">{r.queue}</Td>
                <Td className="max-w-[24rem] truncate" title={r.err ?? ""}>
                  {r.err ?? "—"}
                </Td>
              </tr>
            ))}
          </Tbl>

          <Tbl
            no="4.3"
            title="Slowest loaders, last run"
            cols={[{ label: "Series" }, { label: "Runtime", num: true }, { label: "Last run", num: true }]}
            rows={data.slowestLoaders.length}
            empty="no data"
          >
            {data.slowestLoaders.map((l) => (
              <tr key={l.id}>
                <Td className="font-mono">{seriesLink(l.seriesId, l.seriesName, `loader #${l.id}`)}</Td>
                <Td num>{fmtDur((l.runtime ?? 0) * 1000)}</Td>
                <Td num>{l.lastRunAt ? fmtStamp(l.lastRunAt) : "—"}</Td>
              </tr>
            ))}
          </Tbl>

          <Tbl
            no="4.4"
            title="Loader errors, 24h, latest 20"
            cols={[{ label: "Series" }, { label: "When", num: true }, { label: "Error" }]}
            rows={data.loaderErrors.length}
            empty="none"
          >
            {data.loaderErrors.map((l) => (
              <tr key={l.id}>
                <Td className="font-mono">{seriesLink(l.seriesId, l.seriesName, `loader #${l.id}`)}</Td>
                <Td num>{l.lastErrorAt ? fmtStamp(l.lastErrorAt) : "—"}</Td>
                <Td className="max-w-[20rem] truncate" title={l.lastError ?? ""}>
                  {l.lastError ?? "—"}
                </Td>
              </tr>
            ))}
          </Tbl>

          <div className="lg:col-span-2">
            <Tbl
              no="4.5"
              title="Downloads with no successful fetch in 24h, oldest 20"
              cols={[{ label: "Handle" }, { label: "URL" }, { label: "Last 200", num: true }]}
              rows={data.staleDownloads.length}
              empty="none"
            >
              {data.staleDownloads.map((d) => (
                <tr key={d.handle}>
                  <Td className="font-mono">{d.handle}</Td>
                  <Td className="max-w-[36rem] truncate font-mono" title={d.url}>
                    {d.url}
                  </Td>
                  <Td num>{d.lastDownloadAt ? fmtStamp(d.lastDownloadAt) : "never"}</Td>
                </tr>
              ))}
            </Tbl>
            <p className="text-muted-foreground mt-2 font-mono text-[11px]">
              every loader naming one of these re-attempts it once an hour per process; a moved URL should be updated on the download.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
