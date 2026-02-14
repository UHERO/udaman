"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Universe } from "@catalog/types/shared";
import { universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createUnit, updateUnit } from "@/actions/units";
import { Button } from "@/components/ui/button";
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

interface UnitData {
  id: number;
  universe: string;
  shortLabel: string | null;
  longLabel: string | null;
}

const formSchema = z.object({
  shortLabel: z.string(),
  longLabel: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
});

interface UnitFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  unit?: UnitData | null;
  defaultUniverse?: Universe;
}

export function UnitFormSheet({
  open,
  onOpenChange,
  mode,
  unit,
  defaultUniverse,
}: UnitFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shortLabel: "",
      longLabel: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        shortLabel: unit?.shortLabel ?? "",
        longLabel: unit?.longLabel ?? "",
        universe: (unit?.universe as Universe) ?? defaultUniverse ?? "UHERO",
      });
    }
  }, [open, unit, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        const result = await createUnit({
          shortLabel: values.shortLabel || null,
          longLabel: values.longLabel || null,
          universe: values.universe,
        });
        toast.success(result.message);
      } else if (unit) {
        const result = await updateUnit(unit.id, {
          shortLabel: values.shortLabel || null,
          longLabel: values.longLabel || null,
          universe: values.universe,
        });
        toast.success(result.message);
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save unit",
      );
    }
  }

  const title = mode === "create" ? "Create Unit" : "Edit Unit";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new unit."
              : "Update the unit details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.shortLabel}>
                <FieldLabel htmlFor="shortLabel">Short Label</FieldLabel>
                <Input
                  id="shortLabel"
                  placeholder="e.g. Thou."
                  {...form.register("shortLabel")}
                />
                <FieldError errors={[form.formState.errors.shortLabel]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.longLabel}>
                <FieldLabel htmlFor="longLabel">Long Label</FieldLabel>
                <Input
                  id="longLabel"
                  placeholder="e.g. Thousands"
                  {...form.register("longLabel")}
                />
                <FieldError errors={[form.formState.errors.longLabel]} />
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
