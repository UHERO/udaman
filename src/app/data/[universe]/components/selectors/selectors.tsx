"use client";

/**
 * Props-driven selectors (ports of geo-selector, freq-selector,
 * forecast-selector, measurement-selector). They hold no state and know
 * nothing about the URL — the page decides what a change means.
 * Shared by category (A), series (B), analyzer (C) and search (D) views.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type {
  FreqCode,
  Frequency,
  Geography,
  Measurement,
} from "../../lib/types";
import { PortalSelect } from "./portal-select";

/** Geography label: shortName → name → handle (geo-selector template). */
export const geoLabel = (g: Geography) =>
  g.shortName || (g.name?.length ? g.name : g.handle);

export function GeoSelector({
  geos,
  value,
  onChange,
  className,
}: {
  geos: Geography[];
  /** Selected geography handle. */
  value: string | null | undefined;
  onChange: (geo: Geography) => void;
  className?: string;
}) {
  return (
    <PortalSelect
      ariaLabel="Geography"
      value={value}
      className={className}
      options={geos.map((g) => ({ value: g.handle, label: geoLabel(g) }))}
      onChange={(handle) => {
        const g = geos.find((x) => x.handle === handle);
        if (g) onChange(g);
      }}
    />
  );
}

export function FreqSelector({
  freqs,
  value,
  onChange,
  placeholder,
  className,
}: {
  freqs: Frequency[];
  /** Selected freq code; null shows `placeholder` (analyzer mixed-freq case). */
  value: FreqCode | null | undefined;
  onChange: (freq: Frequency) => void;
  /** e.g. "Index: Switch to a single frequency" (analyzer). */
  placeholder?: string;
  className?: string;
}) {
  return (
    <PortalSelect
      ariaLabel="Frequency"
      value={value}
      placeholder={placeholder}
      className={className}
      options={freqs.map((f) => ({ value: f.freq, label: f.label || f.freq }))}
      onChange={(code) => {
        const f = freqs.find((x) => x.freq === code);
        if (f) onChange(f);
      }}
    />
  );
}

export function ForecastSelector({
  forecasts,
  value,
  onChange,
  labels,
  className,
}: {
  /** Forecast tags, e.g. ["26Q1FF", "25Q4F"]. */
  forecasts: string[];
  value: string | null | undefined;
  onChange: (fc: string) => void;
  /** Optional display labels by tag (defaults to the tag). */
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <PortalSelect
      ariaLabel="Forecast"
      value={value}
      className={className}
      options={forecasts.map((fc) => ({
        value: fc,
        label: labels?.[fc] ?? fc,
      }))}
      onChange={onChange}
    />
  );
}

export function MeasurementSelector({
  measurements,
  value,
  onChange,
  className,
}: {
  measurements: Measurement[];
  /** Selected measurement name. */
  value: string | null | undefined;
  onChange: (m: Measurement) => void;
  className?: string;
}) {
  return (
    <PortalSelect
      ariaLabel="Measurement"
      value={value}
      className={cn("min-w-48", className)}
      options={measurements.map((m) => ({
        value: m.name,
        label: m.indent ? (
          <span style={{ paddingLeft: `${m.indent * 0.75}rem` }}>
            – {m.name}
          </span>
        ) : (
          m.name
        ),
      }))}
      onChange={(name) => {
        const m = measurements.find((x) => x.name === name);
        if (m) onChange(m);
      }}
    />
  );
}

/** Checkbox + label toggle (Year/Year, Year-to-Date, Seasonally Adjusted…). */
export function CheckToggle({
  id,
  label,
  checked,
  onChange,
  className,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap select-none",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="rounded-none data-[state=checked]:border-(--portal-primary) data-[state=checked]:bg-(--portal-primary) data-[state=checked]:text-white"
      />
      {label}
    </label>
  );
}
