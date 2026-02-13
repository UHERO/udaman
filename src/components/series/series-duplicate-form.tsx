"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { duplicateSeries } from "@/actions/series-actions";
import type { SeriesMetadata, Universe } from "@catalog/types/shared";
import type { SeasonalAdjustment } from "@catalog/types/shared";
import type {
  GeographyOption,
  SourceDetailOption,
  SourceOption,
  UnitOption,
} from "@catalog/types/form-options";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { H2 } from "../typography";
import { MetadataFields, metadataSchema } from "./series-create-form";
import {
  SeriesNameFields,
  nameFieldsSchema,
  assembleSeriesName,
} from "./series-name-fields";

// ─── Schema ─────────────────────────────────────────────────────────

const duplicateSchema = z.object({
  ...nameFieldsSchema,
  dataPortalName: z.string().min(1, "Data portal name is required"),
  ...metadataSchema,
  unitId: z.number({ error: "Unit is required" }),
  sourceId: z.number({ error: "Source is required" }),
  copyLoaders: z.boolean(),
});

type DuplicateFormValues = z.infer<typeof duplicateSchema>;

// ─── Props ──────────────────────────────────────────────────────────

interface SeriesDuplicateFormProps {
  universe: string;
  sourceSeriesId: number;
  metadata: SeriesMetadata;
  loaderCount: number;
  geographies: GeographyOption[];
  units: UnitOption[];
  sources: SourceOption[];
  sourceDetails: SourceDetailOption[];
}

// ─── Component ──────────────────────────────────────────────────────

export function SeriesDuplicateForm({
  universe,
  sourceSeriesId,
  metadata,
  loaderCount,
  geographies,
  units,
  sources,
  sourceDetails,
}: SeriesDuplicateFormProps) {
  const nav = useRouter();

  const form = useForm<DuplicateFormValues>({
    resolver: zodResolver(duplicateSchema),
    defaultValues: {
      prefix: "",
      geo: "",
      freq: "",
      dataPortalName: metadata.s_dataPortalName ?? "",
      unitId: metadata.s_unit_id ?? (null as unknown as number),
      sourceId: metadata.s_source_id ?? (null as unknown as number),
      sourceDetailId: metadata.s_source_detail_id ?? null,
      decimals: metadata.s_decimals ?? 1,
      description: metadata.s_description ?? "",
      sourceLink: metadata.s_source_link ?? "",
      seasonalAdjustment:
        metadata.xs_seasonal_adjustment ?? "not_applicable",
      frequencyTransform: metadata.xs_frequency_transform ?? "",
      percent: !!metadata.xs_percent,
      real: !!metadata.xs_real,
      restricted: !!metadata.xs_restricted,
      quarantined: !!metadata.xs_quarantined,
      investigationNotes: metadata.s_investigation_notes ?? "",
      copyLoaders: true,
    },
    mode: "onBlur",
  });

  async function onSubmit(values: DuplicateFormValues) {
    const name = assembleSeriesName(values.prefix, values.geo, values.freq);
    try {
      const result = await duplicateSeries(
        sourceSeriesId,
        universe as Universe,
        values.copyLoaders,
        {
          name,
          universe: universe as Universe,
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
        },
      );
      toast.success(result.message, {
        description: values.copyLoaders
          ? "Loaders copied from source series"
          : "Created without loaders",
      });
      nav.push(`/udaman/${universe}/series/${result.data.id}`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to duplicate series";
      if (msg.includes("Duplicate entry")) {
        form.setError("prefix", {
          message: `"${name}" already exists in ${universe}`,
        });
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <main className="m-4 max-w-2xl">
      <H2 className="mb-2">Duplicate Series</H2>
      <p className="text-muted-foreground mb-7 text-sm">
        Creating a copy of{" "}
        <span className="font-mono font-medium">{metadata.s_name}</span>.
        Change the name and adjust metadata as needed.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <SeriesNameFields
              form={form}
              geographies={geographies}
              idPrefix="dup-"
            />

            <Field
              data-invalid={!!form.formState.errors.dataPortalName}
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
            </Field>

            <MetadataFields
              form={form}
              units={units}
              sources={sources}
              sourceDetails={sourceDetails}
              required={true}
            />

            <Field orientation="horizontal" className="mt-2">
              <Checkbox
                id="copyLoaders"
                checked={form.watch("copyLoaders")}
                onCheckedChange={(checked) =>
                  form.setValue("copyLoaders", checked === true)
                }
              />
              <div>
                <FieldLabel htmlFor="copyLoaders">
                  Copy loaders along with series metadata
                </FieldLabel>
                <FieldDescription>
                  {loaderCount > 0
                    ? `${loaderCount} enabled loader${loaderCount === 1 ? "" : "s"} will be copied`
                    : "Source series has no enabled loaders"}
                </FieldDescription>
              </div>
            </Field>
          </FieldGroup>

          <div className="mt-8 flex flex-row gap-x-4">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Duplicating..."
                : "Duplicate series"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => nav.back()}
            >
              Cancel
            </Button>
          </div>
        </FieldSet>
      </form>
    </main>
  );
}
