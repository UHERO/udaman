"use client";

import { Universe } from "@catalog/types/shared";
import { universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createSourceDetail, updateSourceDetail } from "@/actions/source-details";
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

interface SourceDetailData {
  id: number;
  universe: string;
  description: string | null;
}

const formSchema = z.object({
  description: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
});

interface SourceDetailFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  sourceDetail?: SourceDetailData | null;
  defaultUniverse?: Universe;
}

export function SourceDetailFormSheet({
  open,
  onOpenChange,
  mode,
  sourceDetail,
  defaultUniverse,
}: SourceDetailFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        description: sourceDetail?.description ?? "",
        universe: (sourceDetail?.universe as Universe) ?? defaultUniverse ?? "UHERO",
      });
    }
  }, [open, sourceDetail, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        await createSourceDetail({
          description: values.description || null,
          universe: values.universe,
        });
      } else if (sourceDetail) {
        await updateSourceDetail(sourceDetail.id, {
          description: values.description || null,
          universe: values.universe,
        });
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save source detail:", error);
    }
  }

  const title = mode === "create" ? "Create Source Detail" : "Edit Source Detail";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-0 pt-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new source detail."
              : "Update the source detail."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.description}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input
                  id="description"
                  placeholder="Source detail description"
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
