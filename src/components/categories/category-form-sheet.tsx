"use client";

import {
    Category,
    Frequency,
    Geography,
    Universe,
} from "@catalog/types/shared";
import { frequencies, universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createCategory, updateCategory } from "@/actions/categories";
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

const formSchema = z.object({
  name: z.string(),
  description: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
  defaultFreq: z.enum(["", ...frequencies] as ["", ...Frequency[]]),
  defaultGeoId: z.number().nullable(),
  hidden: z.boolean(),
  masked: z.boolean(),
  header: z.boolean(),
});

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: Category | null;
  parentId?: number | null;
  parentCategory?: Category | null;
  defaultUniverse?: Universe | null;
  geographies: Geography[];
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  mode,
  category,
  parentId,
  parentCategory,
  defaultUniverse,
  geographies,
}: CategoryFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      universe: "UHERO",
      defaultFreq: "",
      defaultGeoId: null,
      hidden: false,
      masked: false,
      header: false,
    },
  });

  // Reset form when category or mode changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        description: category?.description ?? "",
        universe: category?.universe ?? defaultUniverse ?? "UHERO",
        defaultFreq: category?.defaultFreq ?? "",
        defaultGeoId: category?.defaultGeoId ?? null,
        hidden: category?.hidden ?? false,
        masked: category?.masked ?? false,
        header: category?.header ?? false,
      });
    }
  }, [open, category, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        const result = await createCategory({
          parentId: parentId ?? null,
          name: values.name || null,
          description: values.description || null,
          universe: values.universe,
          defaultFreq: values.defaultFreq || null,
          defaultGeoId: values.defaultGeoId,
          hidden: values.hidden,
          // Only send masked if explicitly true; otherwise let backend inherit from parent
          masked: values.masked || undefined,
          header: values.header,
        });
        toast.success(result.message);
      } else if (category) {
        const result = await updateCategory(category.id, {
          name: values.name || null,
          description: values.description || null,
          universe: values.universe,
          defaultFreq: values.defaultFreq || null,
          defaultGeoId: values.defaultGeoId,
          hidden: values.hidden,
          masked: values.masked,
          header: values.header,
        });
        toast.success(result.message);
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
    }
  }

  const title =
    mode === "create"
      ? parentId
        ? "Add Child Category"
        : "Create Category"
      : "Edit Category";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-0 pt-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new category."
              : "Update the category details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="Category name"
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.description}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input
                  id="description"
                  placeholder="Category description"
                  {...form.register("description")}
                />
                <FieldError errors={[form.formState.errors.description]} />
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

              <Field data-invalid={!!form.formState.errors.defaultFreq}>
                <FieldLabel htmlFor="defaultFreq">Default Frequency</FieldLabel>
                <Select
                  value={form.watch("defaultFreq") || "none"}
                  onValueChange={(value) =>
                    form.setValue(
                      "defaultFreq",
                      value === "none" ? "" : (value as Frequency),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {frequencies.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.defaultFreq]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.defaultGeoId}>
                <FieldLabel htmlFor="defaultGeo">Default Geography</FieldLabel>
                <Select
                  value={form.watch("defaultGeoId")?.toString() || "none"}
                  onValueChange={(value) =>
                    form.setValue(
                      "defaultGeoId",
                      value === "none" ? null : Number(value),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select geography" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {geographies.map((geo) => (
                      <SelectItem key={geo.id} value={geo.id.toString()}>
                        {geo.displayName || geo.handle || `ID: ${geo.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.defaultGeoId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="dataList">Data List</FieldLabel>
                <Select value="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Select data list" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex flex-col gap-2">
                {mode === "create" &&
                parentCategory &&
                (parentCategory.hidden || parentCategory.masked) ? (
                  <p className="text-muted-foreground text-sm">
                    This category will be automatically masked because its
                    parent is{" "}
                    {parentCategory.hidden ? "hidden" : "masked"}.
                  </p>
                ) : (
                  <div className="flex items-center gap-6">
                    <Field orientation="horizontal">
                      <Checkbox
                        id="hidden"
                        checked={form.watch("hidden")}
                        onCheckedChange={(checked) =>
                          form.setValue("hidden", checked === true)
                        }
                      />
                      <FieldLabel htmlFor="hidden">Hidden</FieldLabel>
                    </Field>

                    <Field orientation="horizontal">
                      <Checkbox
                        id="masked"
                        checked={form.watch("masked")}
                        onCheckedChange={(checked) =>
                          form.setValue("masked", checked === true)
                        }
                      />
                      <FieldLabel htmlFor="masked">Masked</FieldLabel>
                    </Field>
                  </div>
                )}

                <Field orientation="horizontal">
                  <Checkbox
                    id="header"
                    checked={form.watch("header")}
                    onCheckedChange={(checked) =>
                      form.setValue("header", checked === true)
                    }
                  />
                  <FieldLabel htmlFor="header">Header</FieldLabel>
                </Field>
              </div>
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
