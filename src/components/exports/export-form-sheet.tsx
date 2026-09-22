"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createExportAction } from "@/actions/exports";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

interface ExportFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universe: string;
}

export function ExportFormSheet({
  open,
  onOpenChange,
  universe,
}: ExportFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "" });
    }
  }, [open, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await createExportAction(values.name.trim());
      if (result.success && result.id) {
        toast.success(result.message);
        onOpenChange(false);
        router.push(`/udaman/${universe}/exports/${result.id}`);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create export");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>Create Export</SheetTitle>
          <SheetDescription>
            Fill in the details to create a new export.
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
                  placeholder="Export name"
                  autoFocus
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
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
              {form.formState.isSubmitting ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
