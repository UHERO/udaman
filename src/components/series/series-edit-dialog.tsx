"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { updateSeries } from "@/actions/series-actions";
import type { SeriesMetadata, Universe } from "@catalog/types/shared";
import type { SeriesFormOptions } from "@catalog/types/form-options";
import type { SeasonalAdjustment } from "@catalog/types/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldWarning,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { MetadataFields } from "./series-create-form";
import {
  SeriesNameFields,
  nameFieldsSchema,
  assembleSeriesName,
  parseSeriesName,
  resolveGeoId,
  freqCodeToLong,
} from "./series-name-fields";

// ─── NS series detection ────────────────────────────────────────────
// Pattern: anything ending in NS before the @, e.g. E_NFNS@HI.M
function isNsSeries(name: string | null): boolean {
  if (!name) return false;
  return /NS@/i.test(name);
}

// ─── Schema ─────────────────────────────────────────────────────────

function buildEditSchema(seriesName: string | null) {
  const nsLocked = isNsSeries(seriesName);

  return z
    .object({
      ...nameFieldsSchema,
      dataPortalName: z.string().min(1, "Data Portal Name is required"),
      unitId: z.number({ error: "Unit is required" }),
      sourceId: z.number({ error: "Source is required" }),
      sourceDetailId: z.number().nullable(),
      decimals: z.number(),
      description: z.string(),
      sourceLink: z.string(),
      seasonalAdjustment: z.string().min(1, "Seasonal Adjustment is required"),
      frequencyTransform: z.string().min(1, "Frequency Transform is required"),
      percent: z.boolean(),
      real: z.boolean(),
      restricted: z.boolean(),
      quarantined: z.boolean(),
      investigationNotes: z.string(),
    })
    .superRefine((data, ctx) => {
      // Check NS based on current prefix (user may have changed the name)
      const currentlyNs = /NS$/i.test(data.prefix);
      if (
        (nsLocked || currentlyNs) &&
        data.seasonalAdjustment !== "not_seasonally_adjusted"
      ) {
        ctx.addIssue({
          code: "custom",
          message: "NS series must be Not Seasonally Adjusted",
          path: ["seasonalAdjustment"],
        });
      }
    });
}

type EditFormValues = z.infer<ReturnType<typeof buildEditSchema>>;

// ─── Compute which required fields were originally null ─────────────

function computeNullFields(m: SeriesMetadata): Set<string> {
  const nulls = new Set<string>();
  if (!m.s_dataPortalName) nulls.add("dataPortalName");
  if (m.s_unit_id == null) nulls.add("unitId");
  if (m.s_source_id == null) nulls.add("sourceId");
  if (m.s_decimals == null) nulls.add("decimals");
  if (!m.xs_seasonal_adjustment) nulls.add("seasonalAdjustment");
  if (!m.xs_frequency_transform) nulls.add("frequencyTransform");
  if (m.xs_percent == null) nulls.add("percent");
  if (m.xs_restricted == null) nulls.add("restricted");
  return nulls;
}

function metadataToDefaults(m: SeriesMetadata): EditFormValues {
  const nsLocked = isNsSeries(m.s_name);
  const parsed = parseSeriesName(m.s_name);

  return {
    prefix: parsed.prefix,
    geo: parsed.geo,
    freq: parsed.freq,
    dataPortalName: m.s_dataPortalName ?? "",
    unitId: m.s_unit_id ?? (null as unknown as number),
    sourceId: m.s_source_id ?? (null as unknown as number),
    sourceDetailId: m.s_source_detail_id ?? null,
    decimals: m.s_decimals ?? 0,
    description: m.s_description ?? "",
    sourceLink: m.s_source_link ?? "",
    seasonalAdjustment: m.xs_seasonal_adjustment
      ?? (nsLocked ? "not_seasonally_adjusted" : "not_applicable"),
    frequencyTransform: m.xs_frequency_transform ?? "",
    percent: !!m.xs_percent,
    real: !!m.xs_real,
    restricted: !!m.xs_restricted,
    quarantined: !!m.xs_quarantined,
    investigationNotes: m.s_investigation_notes ?? "",
  };
}

// ─── Unit/Percent cross-check ───────────────────────────────────────

function getPercentWarning(
  unitId: number | null,
  percent: boolean,
  units: SeriesFormOptions["units"],
): string | undefined {
  if (percent || unitId == null) return undefined;
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return undefined;
  const label = `${unit.shortLabel ?? ""} ${unit.longLabel ?? ""}`.toLowerCase();
  if (label.includes("%") || label.includes("perc")) {
    return "Unit field indicates this may be a percent";
  }
  return undefined;
}

// ─── Component ──────────────────────────────────────────────────────

interface SeriesEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  universe: string;
  metadata: SeriesMetadata;
  formOptions: SeriesFormOptions;
}

export function SeriesEditDialog({
  open,
  onOpenChange,
  seriesId,
  universe,
  metadata,
  formOptions,
}: SeriesEditDialogProps) {
  const router = useRouter();

  const editSchema = useMemo(
    () => buildEditSchema(metadata.s_name),
    [metadata.s_name],
  );

  const nullFields = useMemo(() => computeNullFields(metadata), [metadata]);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: metadataToDefaults(metadata),
    mode: "onBlur",
  });

  const watchedUnitId = form.watch("unitId");
  const watchedPercent = form.watch("percent");
  const percentWarning = getPercentWarning(
    watchedUnitId,
    watchedPercent,
    formOptions.units,
  );

  async function onSubmit(values: EditFormValues) {
    const newName = assembleSeriesName(values.prefix, values.geo, values.freq);
    const geoId = resolveGeoId(values.geo, formOptions.geographies);

    try {
      const result = await updateSeries(seriesId, universe as Universe, {
        name: newName,
        geographyId: geoId,
        frequency: freqCodeToLong[values.freq.toUpperCase()] ?? null,
        dataPortalName: values.dataPortalName || undefined,
        unitId: values.unitId,
        sourceId: values.sourceId,
        sourceDetailId: values.sourceDetailId,
        decimals: values.decimals,
        description: values.description || undefined,
        sourceLink: values.sourceLink || undefined,
        seasonalAdjustment: (values.seasonalAdjustment ||
          null) as SeasonalAdjustment | null,
        frequencyTransform: values.frequencyTransform || undefined,
        percent: values.percent,
        real: values.real,
        restricted: values.restricted,
        quarantined: values.quarantined,
        investigationNotes: values.investigationNotes || undefined,
      });
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to update series";
      if (msg.includes("Duplicate entry")) {
        form.setError("prefix", {
          message: `"${newName}" already exists in ${universe}`,
        });
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {metadata.s_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <SeriesNameFields
                form={form}
                geographies={formOptions.geographies}
                idPrefix="edit-"
              />

              <Field
                data-invalid={!!form.formState.errors.dataPortalName}
                data-warning={
                  nullFields.has("dataPortalName") &&
                  !form.formState.errors.dataPortalName
                }
              >
                <FieldLabel htmlFor="dataPortalName">
                  Data Portal Name *
                </FieldLabel>
                <Input
                  id="dataPortalName"
                  placeholder="Display name for data portal"
                  {...form.register("dataPortalName")}
                />
                <FieldError
                  errors={[form.formState.errors.dataPortalName]}
                />
                {nullFields.has("dataPortalName") &&
                  !form.formState.errors.dataPortalName && (
                    <FieldWarning>Was empty — please provide a name</FieldWarning>
                  )}
              </Field>

              <MetadataFields
                form={form}
                units={formOptions.units}
                sources={formOptions.sources}
                sourceDetails={formOptions.sourceDetails}
                required={true}
                nullFields={nullFields}
                percentWarning={percentWarning}
              />
            </FieldGroup>
          </FieldSet>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
