"use client";

import type { GeographyOption } from "@catalog/types/form-options";
import type { Frequency } from "@catalog/types/shared";
import { frequencies } from "@catalog/utils/validators";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Schema & helpers (importable by parent forms) ──────────────────

export const nameFieldsSchema = {
  prefix: z.string().min(1, "Series prefix is required"),
  geo: z.string().min(1, "Geography is required"),
  freq: z.string().min(1, "Frequency is required"),
};

export const freqCodeToLong: Record<string, string> = {
  A: "year",
  S: "semi",
  Q: "quarter",
  M: "month",
  W: "week",
  D: "day",
};

const freqLabels: Record<Frequency, string> = {
  A: "A — Annual",
  S: "S — Semi-annual",
  Q: "Q — Quarterly",
  M: "M — Monthly",
  W: "W — Weekly",
  D: "D — Daily",
};

/** Parse "PREFIX@GEO.FREQ" into parts */
export function parseSeriesName(name: string | null): {
  prefix: string;
  geo: string;
  freq: string;
} {
  if (!name) return { prefix: "", geo: "", freq: "" };
  const m = name.match(/^(.+?)@(\w+?)(?:\.([ASQMWD]))?$/i);
  if (!m) return { prefix: name, geo: "", freq: "" };
  return {
    prefix: m[1],
    geo: m[2].toUpperCase(),
    freq: m[3]?.toUpperCase() ?? "",
  };
}

/** Assemble parts back into "PREFIX@GEO.FREQ" */
export function assembleSeriesName(
  prefix: string,
  geo: string,
  freq: string
): string {
  return `${prefix.toUpperCase()}@${geo.toUpperCase()}.${freq.toUpperCase()}`;
}

/** Resolve a geography handle to its ID */
export function resolveGeoId(
  handle: string,
  geographies: GeographyOption[]
): number | null {
  const geo = geographies.find(
    (g) => g.handle?.toUpperCase() === handle.toUpperCase()
  );
  return geo?.id ?? null;
}

// ─── Component ──────────────────────────────────────────────────────

interface SeriesNameFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  geographies: GeographyOption[];
  /** ID prefix for HTML ids to avoid collisions in multiple forms */
  idPrefix?: string;
}

export function SeriesNameFields({
  form,
  geographies,
  idPrefix = "",
}: SeriesNameFieldsProps) {
  const prefix = form.watch("prefix") ?? "";
  const geo = form.watch("geo") ?? "";
  const freq = form.watch("freq") ?? "";

  const previewName =
    prefix || geo || freq ? assembleSeriesName(prefix, geo, freq) : "";

  return (
    <>
      <div className="flex items-end gap-1.5">
        <Field className="flex-1" data-invalid={!!form.formState.errors.prefix}>
          <FieldLabel>Prefix</FieldLabel>
          <Input
            id={`${idPrefix}prefix`}
            placeholder="E_NF"
            className="font-mono uppercase"
            {...form.register("prefix")}
          />
        </Field>

        <span className="text-muted-foreground mb-2 text-lg font-bold">@</span>

        <Field className="w-40" data-invalid={!!form.formState.errors.geo}>
          <FieldLabel>Geography</FieldLabel>
          <Select
            value={geo}
            onValueChange={(v) =>
              form.setValue("geo", v, { shouldValidate: true })
            }
          >
            <SelectTrigger id={`${idPrefix}geo`}>
              <SelectValue placeholder="Geo" />
            </SelectTrigger>
            <SelectContent>
              {geographies
                .filter((g) => g.handle)
                .map((g) => (
                  <SelectItem key={g.id} value={g.handle!.toUpperCase()}>
                    {g.handle!.toUpperCase()}
                    {g.displayNameShort ? ` — ${g.displayNameShort}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>

        <span className="text-muted-foreground mb-2 text-lg font-bold">.</span>

        <Field className="w-40" data-invalid={!!form.formState.errors.freq}>
          <FieldLabel>Frequency</FieldLabel>
          <Select
            value={freq}
            onValueChange={(v) =>
              form.setValue("freq", v, { shouldValidate: true })
            }
          >
            <SelectTrigger id={`${idPrefix}freq`}>
              <SelectValue placeholder="Freq" />
            </SelectTrigger>
            <SelectContent>
              {frequencies.map((f) => (
                <SelectItem key={f} value={f}>
                  {freqLabels[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <FieldError
        errors={[
          form.formState.errors.prefix,
          form.formState.errors.geo,
          form.formState.errors.freq,
        ]}
      />

      {previewName && (
        <FieldDescription className="font-mono text-xs">
          Preview: {previewName}
        </FieldDescription>
      )}
    </>
  );
}
