"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Universe } from "@catalog/types/shared";
import type { Geography } from "@catalog/types/shared";
import { universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createGeography, updateGeography } from "@/actions/geographies";
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

const formSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  displayNameShort: z.string(),
  fips: z.string(),
  listOrder: z.number().nullable(),
  geotype: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
});

interface GeographyFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  geography?: Geography | null;
  defaultUniverse?: Universe;
}

export function GeographyFormSheet({
  open,
  onOpenChange,
  mode,
  geography,
  defaultUniverse,
}: GeographyFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      handle: "",
      displayName: "",
      displayNameShort: "",
      fips: "",
      listOrder: null,
      geotype: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        handle: geography?.handle ?? "",
        displayName: geography?.displayName ?? "",
        displayNameShort: geography?.displayNameShort ?? "",
        fips: geography?.fips ?? "",
        listOrder: geography?.listOrder ?? null,
        geotype: geography?.geotype ?? "",
        universe: geography?.universe ?? defaultUniverse ?? "UHERO",
      });
    }
  }, [open, geography, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        const result = await createGeography({
          handle: values.handle || null,
          displayName: values.displayName || null,
          displayNameShort: values.displayNameShort || null,
          fips: values.fips || null,
          listOrder: values.listOrder,
          geotype: values.geotype || null,
          universe: values.universe,
        });
        toast.success(result.message);
      } else if (geography) {
        const result = await updateGeography(geography.id, {
          handle: values.handle || null,
          displayName: values.displayName || null,
          displayNameShort: values.displayNameShort || null,
          fips: values.fips || null,
          listOrder: values.listOrder,
          geotype: values.geotype || null,
          universe: values.universe,
        });
        toast.success(result.message);
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save geography",
      );
    }
  }

  const title = mode === "create" ? "Create Geography" : "Edit Geography";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new geography."
              : "Update the geography details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.handle}>
                <FieldLabel htmlFor="handle">Handle</FieldLabel>
                <Input
                  id="handle"
                  placeholder="e.g. HI"
                  {...form.register("handle")}
                />
                <FieldError errors={[form.formState.errors.handle]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.displayName}>
                <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                <Input
                  id="displayName"
                  placeholder="e.g. Hawaii"
                  {...form.register("displayName")}
                />
                <FieldError errors={[form.formState.errors.displayName]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.displayNameShort}>
                <FieldLabel htmlFor="displayNameShort">Short Name</FieldLabel>
                <Input
                  id="displayNameShort"
                  placeholder="e.g. HI"
                  {...form.register("displayNameShort")}
                />
                <FieldError errors={[form.formState.errors.displayNameShort]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.fips}>
                <FieldLabel htmlFor="fips">FIPS</FieldLabel>
                <Input
                  id="fips"
                  placeholder="FIPS code"
                  {...form.register("fips")}
                />
                <FieldError errors={[form.formState.errors.fips]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.listOrder}>
                <FieldLabel htmlFor="listOrder">List Order</FieldLabel>
                <Input
                  id="listOrder"
                  type="number"
                  placeholder="0"
                  value={form.watch("listOrder") ?? ""}
                  onChange={(e) =>
                    form.setValue(
                      "listOrder",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
                <FieldError errors={[form.formState.errors.listOrder]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.geotype}>
                <FieldLabel htmlFor="geotype">Geo Type</FieldLabel>
                <Input
                  id="geotype"
                  placeholder="e.g. state"
                  {...form.register("geotype")}
                />
                <FieldError errors={[form.formState.errors.geotype]} />
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
