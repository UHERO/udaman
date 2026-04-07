"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createUniverse, updateUniverse } from "@/actions/universes";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const createSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z0-9]+$/, "Uppercase letters and digits only"),
  description: z.string(),
  dataPortalUrl: z
    .string()
    .refine((v) => v === "" || /^https?:\/\//i.test(v), {
      message: "Must be a valid http(s) URL",
    }),
});

type FormValues = z.infer<typeof createSchema>;

interface UniverseData {
  name: string;
  description: string | null;
  dataPortalUrl: string | null;
}

interface UniverseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  universe?: UniverseData | null;
  /** Called with the new/updated universe name after a successful save */
  onSaved?: (name: string) => void;
}

export function UniverseFormSheet({
  open,
  onOpenChange,
  mode,
  universe,
  onSaved,
}: UniverseFormSheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      description: "",
      dataPortalUrl: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: universe?.name ?? "",
        description: universe?.description ?? "",
        dataPortalUrl: universe?.dataPortalUrl ?? "",
      });
    }
  }, [open, universe, form]);

  async function onSubmit(values: FormValues) {
    try {
      if (mode === "create") {
        const result = await createUniverse({
          name: values.name,
          description: values.description || null,
          dataPortalUrl: values.dataPortalUrl || null,
        });
        toast.success(result.message);
        onSaved?.(result.data.name);
      } else if (universe) {
        const result = await updateUniverse(universe.name, {
          description: values.description || null,
          dataPortalUrl: values.dataPortalUrl || null,
        });
        toast.success(result.message);
        onSaved?.(result.data.name);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save universe",
      );
    }
  }

  const title = mode === "create" ? "Create Universe" : "Edit Universe";
  const description =
    mode === "create"
      ? "Universes are top-level tenants. After creation you will be switched to the new universe."
      : "Update the universe description and data portal URL.";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
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
                  placeholder="e.g. UHERO"
                  autoCapitalize="characters"
                  disabled={mode === "edit"}
                  {...form.register("name", {
                    setValueAs: (v) =>
                      typeof v === "string" ? v.toUpperCase() : v,
                  })}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.description}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="What is this universe for?"
                  {...form.register("description")}
                />
                <FieldError errors={[form.formState.errors.description]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.dataPortalUrl}>
                <FieldLabel htmlFor="dataPortalUrl">Data Portal URL</FieldLabel>
                <Input
                  id="dataPortalUrl"
                  type="url"
                  placeholder="https://example.org"
                  {...form.register("dataPortalUrl")}
                />
                <FieldError errors={[form.formState.errors.dataPortalUrl]} />
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
