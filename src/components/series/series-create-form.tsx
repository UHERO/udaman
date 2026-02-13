"use client";

import { useRouter } from "next/navigation";
import { bulkCreateSeries, createSeries } from "@/actions/series-actions";
import type {
  GeographyOption,
  SourceDetailOption,
  SourceOption,
  UnitOption,
} from "@catalog/types/form-options";
import type { SeasonalAdjustment, Universe } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldWarning,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { H2 } from "../typography";
import { SeriesNameFields, assembleSeriesName } from "./series-name-fields";

// ─── Constants ──────────────────────────────────────────────────────

const seasonalAdjustmentOptions: {
  value: SeasonalAdjustment;
  label: string;
}[] = [
  { value: "not_seasonally_adjusted", label: "Not Seasonally Adjusted" },
  { value: "seasonally_adjusted", label: "Seasonally Adjusted" },
  { value: "not_applicable", label: "Not Applicable" },
];

const frequencyTransformOptions = [
  { value: "average", label: "Average" },
  { value: "sum", label: "Sum" },
  { value: "first", label: "First" },
  { value: "last", label: "Last" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

// ─── Schemas ────────────────────────────────────────────────────────

export const metadataSchema = {
  unitId: z.number().nullable(),
  sourceId: z.number().nullable(),
  sourceDetailId: z.number().nullable(),
  decimals: z.number(),
  description: z.string(),
  sourceLink: z.string(),
  seasonalAdjustment: z.string(),
  frequencyTransform: z.string(),
  percent: z.boolean(),
  real: z.boolean(),
  restricted: z.boolean(),
  quarantined: z.boolean(),
  investigationNotes: z.string(),
};

const singleFormSchema = z.object({
  prefix: z.string().min(1, "Series prefix is required"),
  geo: z.string().min(1, "Geography is required"),
  freq: z.string().min(1, "Frequency is required"),
  dataPortalName: z.string().min(1, "Data portal name is required"),
  ...metadataSchema,
  unitId: z.number({ error: "Unit is required" }),
  sourceId: z.number({ error: "Source is required" }),
});

const bulkFormSchema = z.object({
  definitions: z.string().min(1, "At least one definition is required"),
  ...metadataSchema,
});

type SingleFormValues = z.infer<typeof singleFormSchema>;
type BulkFormValues = z.infer<typeof bulkFormSchema>;

export const metadataDefaults = {
  unitId: null as number | null,
  sourceId: null as number | null,
  sourceDetailId: null as number | null,
  decimals: 1,
  description: "",
  sourceLink: "",
  seasonalAdjustment: "not_applicable",
  frequencyTransform: "",
  percent: false,
  real: false,
  restricted: false,
  quarantined: false,
  investigationNotes: "",
};

// ─── Props ──────────────────────────────────────────────────────────

interface SeriesCreateFormProps {
  universe: Universe;
  geographies: GeographyOption[];
  units: UnitOption[];
  sources: SourceOption[];
  sourceDetails: SourceDetailOption[];
}

// ─── Shared metadata fields component ───────────────────────────────

export interface MetadataFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  units: UnitOption[];
  sources: SourceOption[];
  sourceDetails: SourceDetailOption[];
  required: boolean;
  /** Field names that were originally null — highlighted with a yellow warning ring */
  nullFields?: Set<string>;
  /** Warning message to show on the percent checkbox (non-blocking) */
  percentWarning?: string;
}

export function MetadataFields({
  form,
  units,
  sources,
  sourceDetails,
  required,
  nullFields,
  percentWarning,
}: MetadataFieldsProps) {
  const warn = (field: string) => nullFields?.has(field) && !form.formState.errors[field];

  return (
    <>
      <Field data-invalid={!!form.formState.errors.description}>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Input
          id="description"
          placeholder="Series description"
          {...form.register("description")}
        />
        <FieldError errors={[form.formState.errors.description]} />
      </Field>

      <Field
        data-invalid={!!form.formState.errors.sourceId}
        data-warning={warn("sourceId")}
      >
        <FieldLabel htmlFor="sourceId">Source{required && " *"}</FieldLabel>
        <Select
          value={form.watch("sourceId")?.toString() || "none"}
          onValueChange={(value) =>
            form.setValue("sourceId", value === "none" ? null : Number(value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.description || `Source #${s.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={[form.formState.errors.sourceId]} />
        {warn("sourceId") && <FieldWarning>Was empty — please select a source</FieldWarning>}
      </Field>

      <Field data-invalid={!!form.formState.errors.sourceLink}>
        <FieldLabel htmlFor="sourceLink">Source Link</FieldLabel>

        <Input
          id="sourceLink"
          placeholder="https://..."
          {...form.register("sourceLink")}
        />
        <FieldDescription>
          A link to the source's website, ex: http://census.gov/
        </FieldDescription>
        <FieldError errors={[form.formState.errors.sourceLink]} />
      </Field>

      <Field data-invalid={!!form.formState.errors.sourceDetailId}>
        <FieldLabel htmlFor="sourceDetailId">Source Detail</FieldLabel>
        <Select
          value={form.watch("sourceDetailId")?.toString() || "none"}
          onValueChange={(value) =>
            form.setValue(
              "sourceDetailId",
              value === "none" ? null : Number(value)
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select source detail" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {sourceDetails.map((sd) => (
              <SelectItem key={sd.id} value={sd.id.toString()}>
                {sd.description || `Detail #${sd.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={[form.formState.errors.sourceDetailId]} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          data-invalid={!!form.formState.errors.unitId}
          data-warning={warn("unitId")}
        >
          <FieldLabel htmlFor="unitId">Unit{required && " *"}</FieldLabel>
          <Select
            value={form.watch("unitId")?.toString() || "none"}
            onValueChange={(value) =>
              form.setValue("unitId", value === "none" ? null : Number(value))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.shortLabel}
                  {u.longLabel ? ` — ${u.longLabel}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[form.formState.errors.unitId]} />
          {warn("unitId") && <FieldWarning>Was empty — please select a unit</FieldWarning>}
        </Field>

        <Field
          data-invalid={!!form.formState.errors.seasonalAdjustment}
          data-warning={warn("seasonalAdjustment")}
        >
          <FieldLabel htmlFor="seasonalAdjustment">
            Seasonal Adjustment
          </FieldLabel>
          <Select
            value={form.watch("seasonalAdjustment") || "none"}
            onValueChange={(value) =>
              form.setValue("seasonalAdjustment", value === "none" ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {seasonalAdjustmentOptions.map((sa) => (
                <SelectItem key={sa.value} value={sa.value}>
                  {sa.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[form.formState.errors.seasonalAdjustment]} />
          {warn("seasonalAdjustment") && (
            <FieldWarning>Was empty — please select a value</FieldWarning>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          data-invalid={!!form.formState.errors.decimals}
          data-warning={warn("decimals")}
        >
          <FieldLabel htmlFor="decimals">Decimals</FieldLabel>
          <Input
            id="decimals"
            type="number"
            value={form.watch("decimals")}
            onChange={(e) =>
              form.setValue("decimals", Number(e.target.value) || 0)
            }
          />
          <FieldError errors={[form.formState.errors.decimals]} />
        </Field>

        <Field
          data-invalid={!!form.formState.errors.frequencyTransform}
          data-warning={warn("frequencyTransform")}
        >
          <FieldLabel htmlFor="frequencyTransform">
            Frequency Transform
          </FieldLabel>
          <Select
            value={form.watch("frequencyTransform") || "none"}
            onValueChange={(value) =>
              form.setValue("frequencyTransform", value === "none" ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {frequencyTransformOptions.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>
                  {ft.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[form.formState.errors.frequencyTransform]} />
          {warn("frequencyTransform") && (
            <FieldWarning>Was empty — please select a method</FieldWarning>
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-6">
          <Field
            orientation="horizontal"
            data-warning={warn("percent")}
          >
            <Checkbox
              id="percent"
              checked={form.watch("percent")}
              onCheckedChange={(checked) =>
                form.setValue("percent", checked === true)
              }
            />
            <FieldLabel htmlFor="percent">Percent</FieldLabel>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="real"
              checked={form.watch("real")}
              onCheckedChange={(checked) =>
                form.setValue("real", checked === true)
              }
            />
            <FieldLabel htmlFor="real">Real</FieldLabel>
          </Field>

          <Field
            orientation="horizontal"
            data-warning={warn("restricted")}
          >
            <Checkbox
              id="restricted"
              checked={form.watch("restricted")}
              onCheckedChange={(checked) =>
                form.setValue("restricted", checked === true)
              }
            />
            <FieldLabel htmlFor="restricted">Restricted</FieldLabel>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="quarantined"
              checked={form.watch("quarantined")}
              onCheckedChange={(checked) =>
                form.setValue("quarantined", checked === true)
              }
            />
            <FieldLabel htmlFor="quarantined">Quarantined</FieldLabel>
          </Field>
        </div>
        {percentWarning && <FieldWarning>{percentWarning}</FieldWarning>}
      </div>

      <Field data-invalid={!!form.formState.errors.investigationNotes}>
        <FieldLabel htmlFor="investigationNotes">
          Investigation Notes
        </FieldLabel>
        <Textarea
          id="investigationNotes"
          placeholder="Notes..."
          rows={3}
          {...form.register("investigationNotes")}
        />
        <FieldError errors={[form.formState.errors.investigationNotes]} />
      </Field>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export function SeriesCreateForm({
  universe,
  geographies,
  units,
  sources,
  sourceDetails,
}: SeriesCreateFormProps) {
  const nav = useRouter();
  const goBack = () => nav.back();

  // ── Single form ──────────────────────────────────────────────────
  const singleForm = useForm<SingleFormValues>({
    resolver: zodResolver(singleFormSchema),
    defaultValues: {
      prefix: "",
      geo: "",
      freq: "",
      dataPortalName: "",
      ...metadataDefaults,
      unitId: null as unknown as number,
      sourceId: null as unknown as number,
    },
  });

  async function onSingleSubmit(values: SingleFormValues) {
    const name = assembleSeriesName(values.prefix, values.geo, values.freq);
    try {
      const result = await createSeries({
        name,
        universe,
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
      toast.success(`Series "${result.name}" created`);
      nav.push(`/udaman/${universe}/series/${result.id}`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to create series";
      if (msg.includes("Duplicate entry")) {
        singleForm.setError("prefix", {
          message: `"${name}" already exists in ${universe}`,
        });
      } else {
        toast.error(msg);
      }
    }
  }

  // ── Bulk form ────────────────────────────────────────────────────
  const bulkForm = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      definitions: "",
      ...metadataDefaults,
    },
  });

  async function onBulkSubmit(values: BulkFormValues) {
    try {
      const result = await bulkCreateSeries({
        universe,
        definitions: values.definitions,
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

      if (result.errors.length > 0 && result.successCount === 0) {
        toast.error(result.errors.join("\n"));
      } else if (result.errors.length > 0) {
        toast.warning(
          `Created ${result.successCount} series with errors:\n${result.errors.join("\n")}`
        );
        nav.push(`/udaman/${universe}/series`);
      } else {
        toast.success(`Created ${result.successCount} series`);
        nav.push(`/udaman/${universe}/series`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Bulk create failed";
      toast.error(msg);
    }
  }

  return (
    <main className="m-4 max-w-2xl">
      <H2 className="mb-7">Create Series</H2>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="bulk">Bulk</TabsTrigger>
        </TabsList>

        {/* ── Single tab ──────────────────────────────────────────── */}
        <TabsContent value="single">
          <form onSubmit={singleForm.handleSubmit(onSingleSubmit)}>
            <FieldSet>
              <FieldGroup>
                <SeriesNameFields
                  form={singleForm}
                  geographies={geographies}
                  idPrefix="create-"
                />

                <Field
                  data-invalid={!!singleForm.formState.errors.dataPortalName}
                >
                  <FieldLabel htmlFor="dataPortalName">
                    Data Portal Name *
                  </FieldLabel>
                  <Input
                    id="dataPortalName"
                    placeholder="Display name for data portal"
                    {...singleForm.register("dataPortalName")}
                  />
                  <FieldError
                    errors={[singleForm.formState.errors.dataPortalName]}
                  />
                </Field>

                <MetadataFields
                  form={singleForm}
                  units={units}
                  sources={sources}
                  sourceDetails={sourceDetails}
                  required={true}
                />
              </FieldGroup>

              <div className="mt-8 flex flex-row gap-x-4">
                <Button
                  type="submit"
                  disabled={singleForm.formState.isSubmitting}
                >
                  {singleForm.formState.isSubmitting
                    ? "Creating..."
                    : "Create series"}
                </Button>
                <Button type="button" variant="outline" onClick={goBack}>
                  Cancel
                </Button>
              </div>
            </FieldSet>
          </form>
        </TabsContent>

        {/* ── Bulk tab ────────────────────────────────────────────── */}
        <TabsContent value="bulk">
          <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)}>
            <FieldSet>
              <FieldGroup>
                <Field data-invalid={!!bulkForm.formState.errors.definitions}>
                  <FieldLabel htmlFor="definitions">Definitions *</FieldLabel>
                  <Textarea
                    id="definitions"
                    className="font-mono text-sm"
                    placeholder={`"SERIES_NAME".ts_eval= %Q|expression|`}
                    rows={10}
                    {...bulkForm.register("definitions")}
                  />
                  <p className="text-muted-foreground text-xs">
                    One definition per line. Format:{" "}
                    <code className="text-xs">
                      {'"NAME".ts_eval= %Q|eval_expression|'}
                    </code>
                  </p>
                  <FieldError
                    errors={[bulkForm.formState.errors.definitions]}
                  />
                </Field>

                <p className="text-muted-foreground mt-2 text-sm font-medium">
                  Optional metadata (applied to all created series)
                </p>

                <MetadataFields
                  form={bulkForm}
                  units={units}
                  sources={sources}
                  sourceDetails={sourceDetails}
                  required={false}
                />
              </FieldGroup>

              <div className="mt-8 flex flex-row gap-x-4">
                <Button
                  type="submit"
                  disabled={bulkForm.formState.isSubmitting}
                >
                  {bulkForm.formState.isSubmitting
                    ? "Creating..."
                    : "Create series"}
                </Button>
                <Button type="button" variant="outline" onClick={goBack}>
                  Cancel
                </Button>
              </div>
            </FieldSet>
          </form>
        </TabsContent>
      </Tabs>
    </main>
  );
}
