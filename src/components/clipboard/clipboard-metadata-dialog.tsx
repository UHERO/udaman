"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type {
  SourceDetailOption,
  SourceOption,
  UnitOption,
} from "@catalog/types/form-options";
import type { SeasonalAdjustment, Universe } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { bulkUpdateClipboardMetadata } from "@/actions/clipboard-actions";
import { getFormOptions } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

// ─── Form schema ────────────────────────────────────────────────────

const formSchema = z.object({
  dataPortalName: z.string(),
  description: z.string(),
  unitId: z.number().nullable(),
  sourceId: z.number().nullable(),
  sourceDetailId: z.number().nullable(),
  sourceLink: z.string(),
  decimals: z.number(),
  seasonalAdjustment: z.string(),
  frequencyTransform: z.string(),
  percent: z.boolean(),
  real: z.boolean(),
  restricted: z.boolean(),
  quarantined: z.boolean(),
  investigationNotes: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

/** All field keys that can be toggled on/off */
type FieldKey = keyof FormValues;

const FIELD_DEFAULTS: FormValues = {
  dataPortalName: "",
  description: "",
  unitId: null,
  sourceId: null,
  sourceDetailId: null,
  sourceLink: "",
  decimals: 1,
  seasonalAdjustment: "",
  frequencyTransform: "",
  percent: false,
  real: false,
  restricted: false,
  quarantined: false,
  investigationNotes: "",
};

// ─── Component ──────────────────────────────────────────────────────

interface ClipboardMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universe: string;
  clipboardCount: number;
  onSuccess?: () => void;
}

export function ClipboardMetadataDialog({
  open,
  onOpenChange,
  universe,
  clipboardCount,
  onSuccess,
}: ClipboardMetadataDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [enabledFields, setEnabledFields] = useState<Set<FieldKey>>(new Set());
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [sourceDetails, setSourceDetails] = useState<SourceDetailOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: FIELD_DEFAULTS,
  });

  // Load form options when dialog opens
  useEffect(() => {
    if (open && !optionsLoaded) {
      startTransition(async () => {
        const opts = await getFormOptions({ universe: universe as Universe });
        setUnits(opts.units);
        setSources(opts.sources);
        setSourceDetails(opts.sourceDetails);
        setOptionsLoaded(true);
      });
    }
  }, [open, optionsLoaded, universe]);

  // Reset enabled fields when dialog opens
  useEffect(() => {
    if (open) {
      setEnabledFields(new Set());
      form.reset(FIELD_DEFAULTS);
    }
  }, [open, form]);

  const toggleField = (field: FieldKey) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const isEnabled = (field: FieldKey) => enabledFields.has(field);

  async function onSubmit(values: FormValues) {
    if (enabledFields.size === 0) {
      toast.error("No fields selected — check at least one field to update");
      return;
    }

    // Build payload with only enabled fields
    const payload: Record<string, unknown> = {};
    for (const field of enabledFields) {
      const value = values[field];
      // Map empty strings to null for optional string fields
      if (
        typeof value === "string" &&
        value === "" &&
        field !== "dataPortalName"
      ) {
        payload[field] = null;
      } else if (field === "seasonalAdjustment" && value === "") {
        payload[field] = null;
      } else {
        payload[field] = value;
      }
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateClipboardMetadata(payload);
        if (result.errors.length > 0) {
          toast.warning(result.message, {
            description: result.errors.slice(0, 3).join("\n"),
          });
        } else {
          toast.success(result.message);
        }
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error("Bulk update failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Metadata Update</DialogTitle>
          <DialogDescription>
            Update metadata across {clipboardCount} clipboard series. Check the
            fields you want to update — unchecked fields will be left unchanged.
          </DialogDescription>
        </DialogHeader>

        {!optionsLoaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldSet>
              <FieldGroup>
                {/* Data Portal Name */}
                <ToggleableField
                  field="dataPortalName"
                  label="Data Portal Name"
                  enabled={isEnabled("dataPortalName")}
                  onToggle={toggleField}
                >
                  <Input
                    placeholder="Display name for data portal"
                    disabled={!isEnabled("dataPortalName")}
                    {...form.register("dataPortalName")}
                  />
                </ToggleableField>

                {/* Description */}
                <ToggleableField
                  field="description"
                  label="Description"
                  enabled={isEnabled("description")}
                  onToggle={toggleField}
                >
                  <Input
                    placeholder="Series description"
                    disabled={!isEnabled("description")}
                    {...form.register("description")}
                  />
                </ToggleableField>

                {/* Source */}
                <ToggleableField
                  field="sourceId"
                  label="Source"
                  enabled={isEnabled("sourceId")}
                  onToggle={toggleField}
                >
                  <Select
                    disabled={!isEnabled("sourceId")}
                    value={form.watch("sourceId")?.toString() || "none"}
                    onValueChange={(v) =>
                      form.setValue("sourceId", v === "none" ? null : Number(v))
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
                </ToggleableField>

                {/* Source Link */}
                <ToggleableField
                  field="sourceLink"
                  label="Source Link"
                  enabled={isEnabled("sourceLink")}
                  onToggle={toggleField}
                >
                  <Input
                    placeholder="https://..."
                    disabled={!isEnabled("sourceLink")}
                    {...form.register("sourceLink")}
                  />
                </ToggleableField>

                {/* Source Detail */}
                <ToggleableField
                  field="sourceDetailId"
                  label="Source Detail"
                  enabled={isEnabled("sourceDetailId")}
                  onToggle={toggleField}
                >
                  <Select
                    disabled={!isEnabled("sourceDetailId")}
                    value={form.watch("sourceDetailId")?.toString() || "none"}
                    onValueChange={(v) =>
                      form.setValue(
                        "sourceDetailId",
                        v === "none" ? null : Number(v),
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
                </ToggleableField>

                {/* Unit + SA row */}
                <div className="grid grid-cols-2 gap-4">
                  <ToggleableField
                    field="unitId"
                    label="Unit"
                    enabled={isEnabled("unitId")}
                    onToggle={toggleField}
                  >
                    <Select
                      disabled={!isEnabled("unitId")}
                      value={form.watch("unitId")?.toString() || "none"}
                      onValueChange={(v) =>
                        form.setValue("unitId", v === "none" ? null : Number(v))
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
                  </ToggleableField>

                  <ToggleableField
                    field="seasonalAdjustment"
                    label="Seasonal Adjustment"
                    enabled={isEnabled("seasonalAdjustment")}
                    onToggle={toggleField}
                  >
                    <Select
                      disabled={!isEnabled("seasonalAdjustment")}
                      value={form.watch("seasonalAdjustment") || "none"}
                      onValueChange={(v) =>
                        form.setValue(
                          "seasonalAdjustment",
                          v === "none" ? "" : v,
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
                  </ToggleableField>
                </div>

                {/* Decimals + Freq Transform row */}
                <div className="grid grid-cols-2 gap-4">
                  <ToggleableField
                    field="decimals"
                    label="Decimals"
                    enabled={isEnabled("decimals")}
                    onToggle={toggleField}
                  >
                    <Input
                      type="number"
                      disabled={!isEnabled("decimals")}
                      value={form.watch("decimals")}
                      onChange={(e) =>
                        form.setValue("decimals", Number(e.target.value) || 0)
                      }
                    />
                  </ToggleableField>

                  <ToggleableField
                    field="frequencyTransform"
                    label="Frequency Transform"
                    enabled={isEnabled("frequencyTransform")}
                    onToggle={toggleField}
                  >
                    <Select
                      disabled={!isEnabled("frequencyTransform")}
                      value={form.watch("frequencyTransform") || "none"}
                      onValueChange={(v) =>
                        form.setValue(
                          "frequencyTransform",
                          v === "none" ? "" : v,
                        )
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
                  </ToggleableField>
                </div>

                {/* Boolean flags — enable checkbox centered above each field */}
                <div className="grid grid-cols-4 gap-4">
                  {(
                    [
                      ["percent", "Percent"],
                      ["real", "Real"],
                      ["restricted", "Restricted"],
                      ["quarantined", "Quarantined"],
                    ] as const
                  ).map(([field, label]) => (
                    <div
                      key={field}
                      className={`flex flex-col items-center gap-2 ${isEnabled(field) ? "" : "opacity-50"}`}
                    >
                      <Checkbox
                        checked={isEnabled(field)}
                        onCheckedChange={() => toggleField(field)}
                      />
                      <Field orientation="horizontal">
                        <Checkbox
                          disabled={!isEnabled(field)}
                          checked={form.watch(field)}
                          onCheckedChange={(v) =>
                            form.setValue(field, v === true)
                          }
                        />
                        <FieldLabel>{label}</FieldLabel>
                      </Field>
                    </div>
                  ))}
                </div>

                {/* Investigation Notes */}
                <ToggleableField
                  field="investigationNotes"
                  label="Investigation Notes"
                  enabled={isEnabled("investigationNotes")}
                  onToggle={toggleField}
                >
                  <Textarea
                    placeholder="Notes..."
                    rows={3}
                    disabled={!isEnabled("investigationNotes")}
                    {...form.register("investigationNotes")}
                  />
                </ToggleableField>
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
              <Button
                type="submit"
                disabled={isPending || enabledFields.size === 0}
              >
                {isPending ? "Updating..." : `Update ${clipboardCount} series`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Toggleable field wrappers ──────────────────────────────────────

function ToggleableField({
  field,
  label,
  enabled,
  onToggle,
  children,
}: {
  field: FieldKey;
  label: string;
  enabled: boolean;
  onToggle: (field: FieldKey) => void;
  children: React.ReactNode;
}) {
  return (
    <Field className={enabled ? "" : "opacity-50"}>
      <div className="flex items-center gap-2">
        <Checkbox checked={enabled} onCheckedChange={() => onToggle(field)} />
        <FieldLabel htmlFor={field}>{label}</FieldLabel>
      </div>
      {children}
    </Field>
  );
}
