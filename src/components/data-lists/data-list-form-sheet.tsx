"use client";

import { Universe } from "@catalog/types/shared";
import { universes } from "@catalog/utils/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createDataList, updateDataList } from "@/actions/data-lists";
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

interface DataListData {
  id: number;
  universe: string;
  name: string | null;
}

const formSchema = z.object({
  name: z.string(),
  universe: z.enum(universes as [Universe, ...Universe[]]),
});

interface DataListFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  dataList?: DataListData | null;
  defaultUniverse?: Universe;
}

export function DataListFormSheet({
  open,
  onOpenChange,
  mode,
  dataList,
  defaultUniverse,
}: DataListFormSheetProps) {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: dataList?.name ?? "",
        universe: (dataList?.universe as Universe) ?? defaultUniverse ?? "UHERO",
      });
    }
  }, [open, dataList, defaultUniverse, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        await createDataList({
          name: values.name || null,
          universe: values.universe,
        });
      } else if (dataList) {
        await updateDataList(dataList.id, {
          name: values.name || null,
          universe: values.universe,
        });
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save data list:", error);
    }
  }

  const title = mode === "create" ? "Create Data List" : "Edit Data List";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pb-0 pt-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new data list."
              : "Update the data list details."}
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
                  placeholder="Data list name"
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
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
