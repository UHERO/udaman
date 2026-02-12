"use client";

import Loader from "@catalog/models/loader";
import type { SerializedLoader } from "@catalog/models/loader";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { updateDataLoader } from "@/actions/data-loaders";
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
import { cn } from "@/lib/utils";

const formSchema = z.object({
  eval: z.string().min(2, { message: "Code is required." }),
  priority: z
    .number()
    .min(0, { message: "Priority must be between 0 and 100" })
    .max(100, { message: "Priority must be between 0 and 100" }),
  scale: z.number(),
  presaveHook: z.string(),
  clearBeforeLoad: z.boolean(),
  pseudoHistory: z.boolean(),
  reloadNightly: z.boolean(),
  color: z.string(),
});

interface LoaderEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loader: SerializedLoader | null;
}

const presaveHooks = ["update_full_years_top_priority"];

export function LoaderEditSheet({
  open,
  onOpenChange,
  loader,
}: LoaderEditSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eval: "",
      priority: 50,
      scale: 1.0,
      presaveHook: "",
      clearBeforeLoad: false,
      pseudoHistory: false,
      reloadNightly: false,
      color: "",
    },
  });

  const evalValue = form.watch("eval");
  const pseudoHistoryValue = form.watch("pseudoHistory");

  const colorOptions = useMemo(() => {
    const loaderType = Loader.getLoaderType(evalValue || "", pseudoHistoryValue);
    return Loader.getColorPalette(loaderType);
  }, [evalValue, pseudoHistoryValue]);

  useEffect(() => {
    if (open && loader) {
      form.reset({
        eval: loader.eval ?? "",
        priority: loader.priority ?? 50,
        scale: parseFloat(loader.scale) || 1.0,
        presaveHook: loader.presaveHook ?? "",
        clearBeforeLoad: loader.clearBeforeLoad ?? false,
        pseudoHistory: loader.pseudoHistory ?? false,
        reloadNightly: loader.reloadNightly ?? false,
        color: loader.color ?? "",
      });
    }
  }, [open, loader, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!loader) return;
    try {
      await updateDataLoader(loader.id, values);
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update loader:", error);
    }
  }

  const selectedColor = form.watch("color");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-0 pt-3">
          <SheetTitle>Edit Loader {loader?.id}</SheetTitle>
          <SheetDescription>Update the loader configuration.</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.eval}>
                <FieldLabel htmlFor="edit-eval">Code</FieldLabel>
                <Input
                  id="edit-eval"
                  placeholder="enter load statement"
                  aria-invalid={!!form.formState.errors.eval}
                  {...form.register("eval")}
                />
                <FieldDescription>
                  Field will be evaluated as code to load data points
                </FieldDescription>
                <FieldError errors={[form.formState.errors.eval]} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!form.formState.errors.priority}>
                  <FieldLabel htmlFor="edit-priority">Priority</FieldLabel>
                  <Input
                    id="edit-priority"
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
                  <FieldLabel htmlFor="edit-scale">Scale</FieldLabel>
                  <Input
                    id="edit-scale"
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

              <Field>
                <FieldLabel>Color</FieldLabel>
                <div className="flex flex-row gap-2">
                  {colorOptions.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => form.setValue("color", hex)}
                      className={cn(
                        "flex h-12 w-16 items-center justify-center rounded-md border-2 text-xs font-mono transition-all",
                        selectedColor === hex
                          ? "border-primary ring-primary/30 ring-2"
                          : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: `#${hex}` }}
                    >
                      {hex}
                    </button>
                  ))}
                </div>
              </Field>

              <Field data-invalid={!!form.formState.errors.presaveHook}>
                <FieldLabel htmlFor="edit-presaveHook">Presave Hook</FieldLabel>
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
                      <SelectTrigger id="edit-presaveHook" className="min-w-sm">
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
                <Checkbox
                  id="edit-clearBeforeLoad"
                  checked={form.watch("clearBeforeLoad")}
                  onCheckedChange={(checked) =>
                    form.setValue("clearBeforeLoad", checked === true)
                  }
                />
                <FieldLabel htmlFor="edit-clearBeforeLoad">
                  Always clear existing data points before loading
                </FieldLabel>
                <FieldError errors={[form.formState.errors.clearBeforeLoad]} />
              </Field>

              <Field
                orientation="horizontal"
                data-invalid={!!form.formState.errors.pseudoHistory}
              >
                <Checkbox
                  id="edit-pseudoHistory"
                  checked={form.watch("pseudoHistory")}
                  onCheckedChange={(checked) =>
                    form.setValue("pseudoHistory", checked === true)
                  }
                />
                <FieldLabel htmlFor="edit-pseudoHistory">
                  This load is pseudo-history
                </FieldLabel>
                <FieldError errors={[form.formState.errors.pseudoHistory]} />
              </Field>

              <Field
                orientation="horizontal"
                data-invalid={!!form.formState.errors.reloadNightly}
              >
                <Checkbox
                  id="edit-reloadNightly"
                  checked={form.watch("reloadNightly")}
                  onCheckedChange={(checked) =>
                    form.setValue("reloadNightly", checked === true)
                  }
                />
                <FieldLabel htmlFor="edit-reloadNightly">
                  Reload nightly
                </FieldLabel>
                <FieldError errors={[form.formState.errors.reloadNightly]} />
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
              {form.formState.isSubmitting ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
