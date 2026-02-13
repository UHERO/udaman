"use client";

import { SeasonalAdjustment, Universe } from "@catalog/types/shared";
import { universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createMeasurement, updateMeasurement } from "@/actions/measurements";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface MeasurementData {
  id: number;
  universe: string;
  prefix: string;
  dataPortalName: string | null;
  unitId: number | null;
  sourceId: number | null;
  sourceDetailId: number | null;
  decimals: number;
  percent: boolean | null;
  real: boolean | null;
  restricted: boolean;
  seasonalAdjustment: SeasonalAdjustment | null;
  frequencyTransform: string | null;
  sourceLink: string | null;
  notes: string | null;
}

interface OptionItem {
  id: number;
  label: string;
}

const seasonalAdjustmentOptions: { value: SeasonalAdjustment; label: string }[] = [
  { value: "not_seasonally_adjusted", label: "Not Seasonally Adjusted" },
  { value: "seasonally_adjusted", label: "Seasonally Adjusted" },
  { value: "not_applicable", label: "Not Applicable" },
];

const formSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
  dataPortalName: z.string(),
  unitId: z.number().nullable(),
  sourceId: z.number().nullable(),
  sourceDetailId: z.number().nullable(),
  decimals: z.number(),
  percent: z.boolean(),
  real: z.boolean(),
  restricted: z.boolean(),
  seasonalAdjustment: z.string(),
  frequencyTransform: z.string(),
  sourceLink: z.string(),
  notes: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
});

interface MeasurementFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  measurement?: MeasurementData | null;
  defaultUniverse?: Universe;
  units: OptionItem[];
  sources: OptionItem[];
  sourceDetails: OptionItem[];
}

export function MeasurementFormSheet({
  open,
  onOpenChange,
  mode,
  measurement,
  defaultUniverse,
  units,
  sources,
  sourceDetails,
}: MeasurementFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prefix: "",
      dataPortalName: "",
      unitId: null,
      sourceId: null,
      sourceDetailId: null,
      decimals: 1,
      percent: false,
      real: false,
      restricted: false,
      seasonalAdjustment: "",
      frequencyTransform: "",
      sourceLink: "",
      notes: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        prefix: measurement?.prefix ?? "",
        dataPortalName: measurement?.dataPortalName ?? "",
        unitId: measurement?.unitId ?? null,
        sourceId: measurement?.sourceId ?? null,
        sourceDetailId: measurement?.sourceDetailId ?? null,
        decimals: measurement?.decimals ?? 1,
        percent: measurement?.percent ?? false,
        real: measurement?.real ?? false,
        restricted: measurement?.restricted ?? false,
        seasonalAdjustment: measurement?.seasonalAdjustment ?? "",
        frequencyTransform: measurement?.frequencyTransform ?? "",
        sourceLink: measurement?.sourceLink ?? "",
        notes: measurement?.notes ?? "",
        universe: (measurement?.universe as Universe) ?? defaultUniverse ?? "UHERO",
      });
    }
  }, [open, measurement, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const payload = {
        prefix: values.prefix,
        dataPortalName: values.dataPortalName || null,
        unitId: values.unitId,
        sourceId: values.sourceId,
        sourceDetailId: values.sourceDetailId,
        decimals: values.decimals,
        percent: values.percent,
        real: values.real,
        restricted: values.restricted,
        seasonalAdjustment: (values.seasonalAdjustment || null) as SeasonalAdjustment | null,
        frequencyTransform: values.frequencyTransform || null,
        sourceLink: values.sourceLink || null,
        notes: values.notes || null,
        universe: values.universe,
      };

      if (mode === "create") {
        const result = await createMeasurement(payload);
        toast.success(result.message);
      } else if (measurement) {
        const result = await updateMeasurement(measurement.id, payload);
        toast.success(result.message);
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save measurement");
    }
  }

  const title = mode === "create" ? "Create Measurement" : "Edit Measurement";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-0 pt-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new measurement."
              : "Update the measurement details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.prefix}>
                <FieldLabel htmlFor="prefix">Prefix</FieldLabel>
                <Input
                  id="prefix"
                  placeholder="e.g. ECON"
                  {...form.register("prefix")}
                />
                <FieldError errors={[form.formState.errors.prefix]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.dataPortalName}>
                <FieldLabel htmlFor="dataPortalName">Data Portal Name</FieldLabel>
                <Input
                  id="dataPortalName"
                  placeholder="Display name"
                  {...form.register("dataPortalName")}
                />
                <FieldError errors={[form.formState.errors.dataPortalName]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.unitId}>
                <FieldLabel htmlFor="unitId">Unit</FieldLabel>
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
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.unitId]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.sourceId}>
                <FieldLabel htmlFor="sourceId">Source</FieldLabel>
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
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.sourceId]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.sourceDetailId}>
                <FieldLabel htmlFor="sourceDetailId">Source Detail</FieldLabel>
                <Select
                  value={form.watch("sourceDetailId")?.toString() || "none"}
                  onValueChange={(value) =>
                    form.setValue(
                      "sourceDetailId",
                      value === "none" ? null : Number(value),
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
                        {sd.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.sourceDetailId]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.decimals}>
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

              <Field data-invalid={!!form.formState.errors.seasonalAdjustment}>
                <FieldLabel htmlFor="seasonalAdjustment">
                  Seasonal Adjustment
                </FieldLabel>
                <Select
                  value={form.watch("seasonalAdjustment") || "none"}
                  onValueChange={(value) =>
                    form.setValue(
                      "seasonalAdjustment",
                      value === "none" ? "" : value,
                    )
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
                <FieldError
                  errors={[form.formState.errors.seasonalAdjustment]}
                />
              </Field>

              <Field data-invalid={!!form.formState.errors.frequencyTransform}>
                <FieldLabel htmlFor="frequencyTransform">
                  Frequency Transform
                </FieldLabel>
                <Input
                  id="frequencyTransform"
                  placeholder="e.g. average"
                  {...form.register("frequencyTransform")}
                />
                <FieldError
                  errors={[form.formState.errors.frequencyTransform]}
                />
              </Field>

              <Field data-invalid={!!form.formState.errors.sourceLink}>
                <FieldLabel htmlFor="sourceLink">Source Link</FieldLabel>
                <Input
                  id="sourceLink"
                  placeholder="https://..."
                  {...form.register("sourceLink")}
                />
                <FieldError errors={[form.formState.errors.sourceLink]} />
              </Field>

              <div className="flex items-center gap-6">
                <Field orientation="horizontal">
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

                <Field orientation="horizontal">
                  <Checkbox
                    id="restricted"
                    checked={form.watch("restricted")}
                    onCheckedChange={(checked) =>
                      form.setValue("restricted", checked === true)
                    }
                  />
                  <FieldLabel htmlFor="restricted">Restricted</FieldLabel>
                </Field>
              </div>

              <Field data-invalid={!!form.formState.errors.notes}>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  rows={3}
                  {...form.register("notes")}
                />
                <FieldError errors={[form.formState.errors.notes]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.universe}>
                <FieldLabel htmlFor="universe">Universe</FieldLabel>
                <Select
                  value={form.watch("universe")}
                  onValueChange={(value) =>
                    form.setValue("universe", value as Universe)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select universe" />
                  </SelectTrigger>
                  <SelectContent>
                    {universes.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.universe]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <SheetFooter className="mt-1">
            <Button
              className="cursor-pointer"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
