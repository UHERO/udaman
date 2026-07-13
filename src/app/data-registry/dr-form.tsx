"use client";

import { useState } from "react";
import { createDataSouce, updateDataSouce } from "@/actions/data-registry";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, SquarePen } from "lucide-react";
import { type Session } from "next-auth";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/ui/loader";

import { SecurityInfoLink } from "./dr-table";
import { formats, securityColors, securityLevels } from "./utils";

// Kept as a named type alias so runToast's signature stays stable if we swap
// the toast lib again. sonner's imperative `toast()` is variadic — this is a
// narrower slice matching what runToast uses.
type ToastFn = (title: string, opts?: { description?: string }) => void;

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(500),
  source: z.string().min(5, "Source must be at least 5 characters.").max(255),
  access: z.string().min(5, "Access must have at least 5 characters").max(255),
  owner: z.string().min(5, "Owner must be at least 5 characters.").max(255),
  contact: z.string().min(5, "Contact must be at least 5 characters.").max(255),
  format: z.enum([
    "SQL",
    "PDF",
    "DOCX",
    "XLSX",
    "CSV",
    "API",
    "MULTI",
    "OTHER",
  ]),
  security: z.enum(["Public", "Restricted", "Sensitive", "Regulated"]),
  description: z
    .string()
    .min(50, "Description must be at least 50 characters.")
    .max(1200),
});

export type DataRegistryFormType = z.infer<typeof formSchema>;
export interface InitialFormValues extends DataRegistryFormType {
  id: number;
}

export function DataRegistryForm({
  initialValues,
  isUpdate,
  user,
}: {
  initialValues?: InitialFormValues;
  isUpdate: boolean;
  user: Session;
}) {
  const { formState } = useForm();
  const { isSubmitting } = formState;
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: isUpdate
      ? initialValues
      : {
          title: "",
          source: "",
          access: "",
          owner: "",
          contact: "",
          description: "",
        },
  });

  const [open, setOpen] = useState(false);

  // `toast` imported at top from sonner — no hook needed.

  async function onSubmit(data: DataRegistryFormType) {
    try {
      const res =
        isUpdate && initialValues?.id
          ? await updateDataSouce(data, user, initialValues.id)
          : await createDataSouce(data, user);

      if (res.success) {
        runToast(
          toast,
          "Success",
          isUpdate ? "Updated data source." : "Added new data source."
        );
      } else {
        runToast(
          toast,
          "Error",
          (res.error as string) ?? "Failed to save entry."
        );
      }

      form.reset();
      setOpen(false);
    } catch (err) {
      console.error("Unexpected error:", err);
      runToast(toast, "Error", "An unexpected error occurred.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-fit" asChild>
        {isUpdate ? (
          <button className="rounded-lg bg-blue-400/20 px-2 py-1 text-cyan-600 duration-100 ease-in-out hover:-translate-y-px">
            <SquarePen size={18} />
          </button>
        ) : (
          <Button variant={"outline"} type="button">
            <FilePlus2 size={18} />
            <span>Add New Data Source</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="h-5/6 min-w-[800px] overflow-y-auto">
        {isUpdate ? (
          <>
            <DialogTitle>Update UHERO Data Source Entry</DialogTitle>
            <DialogDescription>Edit this current data entry.</DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle>New UHERO Data Source Entry</DialogTitle>
            <DialogDescription>
              Enter a data source for UHERO inventory.
            </DialogDescription>
          </>
        )}
        <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-title">Title</FieldLabel>
                  <Input
                    {...field}
                    id="form-rhf-demo-title"
                    aria-invalid={fieldState.invalid}
                    placeholder="Hawaii State Legislative Bills"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="source"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-source">Source</FieldLabel>
                  <Input
                    {...field}
                    id="form-rhf-demo-source"
                    aria-invalid={fieldState.invalid}
                    placeholder="UHERO Utilities"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="access"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-access">Access</FieldLabel>
                  <Input
                    {...field}
                    id="form-rhf-demo-access"
                    aria-invalid={fieldState.invalid}
                    placeholder="https://uhu.uhero.hawaii.edu/bill-tracker"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="format"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-format">Format</FieldLabel>

                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <SelectTrigger
                      id="form-rhf-demo-format"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="CSV" />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((format, idx) => (
                        <SelectItem
                          className="cursor-pointer hover:bg-secondary"
                          value={format}
                          key={`format-${idx}-${format}`}
                        >
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="security"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-security">
                    <SecurityInfoLink />
                  </FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <SelectTrigger
                      id="form-rhf-demo-security"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Select security level" />
                    </SelectTrigger>
                    <SelectContent>
                      {securityLevels.map((sec, idx) => (
                        <SelectItem
                          className="cursor-pointer hover:bg-secondary"
                          value={sec}
                          key={`${idx}-${sec}`}
                        >
                          <span
                            className={cn(
                              securityColors[sec],
                              "rounded-full px-3 py-0.5 text-zinc-800"
                            )}
                          >
                            {sec}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="owner"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-owner">Owner</FieldLabel>
                  <Input
                    {...field}
                    id="form-rhf-demo-owner"
                    aria-invalid={fieldState.invalid}
                    placeholder="Gabrielle Dang"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="contact"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-contact">
                    Contact
                  </FieldLabel>
                  <Input
                    {...field}
                    id="form-rhf-demo-contact"
                    aria-invalid={fieldState.invalid}
                    placeholder="dangg@hawaii.edu"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-rhf-demo-description">
                    Description
                  </FieldLabel>
                  <div className="relative">
                    <Textarea
                      {...field}
                      id="form-rhf-demo-description"
                      placeholder="A state legislative bill tracker that provides daily updates, monitoring bill progress and changes with text message updates. View at: https://uhu.uhero.hawaii.edu/bill-tracker"
                      rows={6}
                      className="min-h-24 resize-none pb-8"
                      aria-invalid={fieldState.invalid}
                    />
                    <span className="text-muted-foreground pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums">
                      {field.value.length}/1200 characters
                    </span>
                  </div>
                  <FieldDescription>
                    Include any background information and details regarding
                    this data source.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Field orientation="horizontal">
            {!isUpdate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
              >
                Reset
              </Button>
            )}
            <Button type="submit" form="form-rhf-demo">
              {isSubmitting ? <Loader /> : "Submit"}
            </Button>
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function runToast(toast: ToastFn, title: string, description: string) {
  return toast(title, { description });
}
