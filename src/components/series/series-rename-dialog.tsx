"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { updateSeries } from "@/actions/series-actions";
import type { SeriesMetadata, Universe } from "@catalog/types/shared";
import type { SeriesFormOptions } from "@catalog/types/form-options";

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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  SeriesNameFields,
  nameFieldsSchema,
  assembleSeriesName,
  parseSeriesName,
  resolveGeoId,
  freqCodeToLong,
} from "./series-name-fields";

// ─── Schema ─────────────────────────────────────────────────────────

const renameSchema = z.object({
  ...nameFieldsSchema,
  dataPortalName: z.string().min(1, "Data Portal Name is required"),
});

type RenameFormValues = z.infer<typeof renameSchema>;

// ─── Component ──────────────────────────────────────────────────────

interface SeriesRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  universe: Universe;
  metadata: SeriesMetadata;
  formOptions: SeriesFormOptions;
}

export function SeriesRenameDialog({
  open,
  onOpenChange,
  seriesId,
  universe,
  metadata,
  formOptions,
}: SeriesRenameDialogProps) {
  const router = useRouter();
  const parsed = parseSeriesName(metadata.s_name);

  const form = useForm<RenameFormValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: {
      prefix: parsed.prefix,
      geo: parsed.geo,
      freq: parsed.freq,
      dataPortalName: metadata.s_dataPortalName ?? "",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: RenameFormValues) {
    const newName = assembleSeriesName(values.prefix, values.geo, values.freq);
    const geoId = resolveGeoId(values.geo, formOptions.geographies);

    try {
      await updateSeries(seriesId, universe, {
        name: newName,
        dataPortalName: values.dataPortalName,
        geographyId: geoId,
        frequency: freqCodeToLong[values.freq.toUpperCase()] ?? null,
      });
      toast.success("Series renamed", { description: newName });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to rename series";
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rename {metadata.s_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <SeriesNameFields
                form={form}
                geographies={formOptions.geographies}
                idPrefix="rename-"
              />

              <Field data-invalid={!!form.formState.errors.dataPortalName}>
                <FieldLabel htmlFor="rename-dpn">
                  Data Portal Name *
                </FieldLabel>
                <Input
                  id="rename-dpn"
                  placeholder="Display name for data portal"
                  {...form.register("dataPortalName")}
                />
                <FieldError
                  errors={[form.formState.errors.dataPortalName]}
                />
              </Field>
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
              {form.formState.isSubmitting ? "Saving..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
