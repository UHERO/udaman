"use client";

import type { Universe } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { createDataLoader } from "@/actions/data-loaders";
import { toast } from "sonner";
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
  FieldDescription,
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

const formSchema = z.object({
  code: z.string().min(2, { message: "Code is required." }),
  priority: z
    .number()
    .min(0, { message: "Priority must be between 0 and 100" })
    .max(100, { message: "Priority must be between 0 and 100" }),
  scale: z.number(),
  presaveHook: z.string(),
  clearBeforeLoad: z.boolean(),
  pseudoHistory: z.boolean(),
});

interface LoaderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universe: string;
  seriesId: number;
}

const presaveHooks = ["update_full_years_top_priority"];

export function LoaderCreateDialog({
  open,
  onOpenChange,
  universe,
  seriesId,
}: LoaderCreateDialogProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      priority: 100,
      scale: 1.0,
      presaveHook: "",
      clearBeforeLoad: false,
      pseudoHistory: false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        code: "",
        priority: 100,
        scale: 1.0,
        presaveHook: "",
        clearBeforeLoad: false,
        pseudoHistory: false,
      });
    }
  }, [open, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await createDataLoader({ universe: universe as Universe, seriesId }, values);
      toast.success(result.message);
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create loader");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new loader</DialogTitle>
          <DialogDescription>
            Create a new data loader for this series.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.code}>
                <FieldLabel htmlFor="create-code">Code</FieldLabel>
                <Input
                  id="create-code"
                  placeholder="enter load statement"
                  aria-invalid={!!form.formState.errors.code}
                  {...form.register("code")}
                />
                <FieldDescription>
                  Field will be evaluated as code to load data points
                </FieldDescription>
                <FieldError errors={[form.formState.errors.code]} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!form.formState.errors.priority}>
                  <FieldLabel htmlFor="create-priority">Priority</FieldLabel>
                  <Input
                    id="create-priority"
                    type="number"
                    min={0}
                    max={100}
                    aria-invalid={!!form.formState.errors.priority}
                    {...form.register("priority", { valueAsNumber: true })}
                  />
                  <FieldDescription>
                    Higher priority loaders take precedence
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.priority]} />
                </Field>

                <Field data-invalid={!!form.formState.errors.scale}>
                  <FieldLabel htmlFor="create-scale">Scale</FieldLabel>
                  <Input
                    id="create-scale"
                    type="number"
                    min={0}
                    step="any"
                    aria-invalid={!!form.formState.errors.scale}
                    {...form.register("scale", { valueAsNumber: true })}
                  />
                  <FieldDescription>
                    Multiply original data by this factor
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.scale]} />
                </Field>
              </div>

              <Field data-invalid={!!form.formState.errors.presaveHook}>
                <FieldLabel htmlFor="create-presaveHook">
                  Presave Hook
                </FieldLabel>
                <Controller
                  name="presaveHook"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? "" : v)
                      }
                      value={field.value || "none"}
                    >
                      <SelectTrigger
                        id="create-presaveHook"
                        className="min-w-sm"
                      >
                        <SelectValue placeholder="Select hook (this is uncommon)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {presaveHooks.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  Method called prior to storing data points during load
                </FieldDescription>
                <FieldError errors={[form.formState.errors.presaveHook]} />
              </Field>

              <Field
                orientation="horizontal"
                data-invalid={!!form.formState.errors.clearBeforeLoad}
              >
                <Controller
                  name="clearBeforeLoad"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      id="create-clearBeforeLoad"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FieldLabel htmlFor="create-clearBeforeLoad">
                  Always clear existing data points before loading
                </FieldLabel>
                <FieldError errors={[form.formState.errors.clearBeforeLoad]} />
              </Field>

              <Field
                orientation="horizontal"
                data-invalid={!!form.formState.errors.pseudoHistory}
              >
                <Controller
                  name="pseudoHistory"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      id="create-pseudoHistory"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FieldLabel htmlFor="create-pseudoHistory">
                  This load is pseudo-history
                </FieldLabel>
                <FieldError errors={[form.formState.errors.pseudoHistory]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save loader"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
