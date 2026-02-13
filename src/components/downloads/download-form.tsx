"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import {
  createDownloadAction,
  updateDownloadAction,
  deleteDownloadAction,
} from "@/actions/download-actions";
import type { DownloadFormData } from "@catalog/controllers/downloads";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DeleteDownloadDialog } from "@/components/downloads/delete-download-dialog";

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
import { Textarea } from "@/components/ui/textarea";

// ─── Schema ─────────────────────────────────────────────────────────

const downloadSchema = z.object({
  handle: z.string().min(1, "Handle is required"),
  url: z.string(),
  filenameExt: z.string(),
  dateSensitive: z.boolean(),
  freezeFile: z.boolean(),
  sort1: z.number().nullable(),
  sort2: z.number().nullable(),
  fileToExtract: z.string(),
  sheetOverride: z.string(),
  postParameters: z.string(),
  notes: z.string(),
});

type DownloadFormValues = z.infer<typeof downloadSchema>;

const filenameExtOptions = [
  { value: "xlsx", label: "xlsx" },
  { value: "xls", label: "xls" },
  { value: "zip", label: "zip" },
  { value: "csv", label: "csv" },
  { value: "txt", label: "txt" },
  { value: "pdf", label: "pdf" },
];

// ─── Props ──────────────────────────────────────────────────────────

interface DownloadFormProps {
  download?: DownloadFormData;
  mode?: "create" | "edit" | "duplicate";
}

// ─── Component ──────────────────────────────────────────────────────

export function DownloadForm({ download, mode = download ? "edit" : "create" }: DownloadFormProps) {
  const router = useRouter();
  const params = useParams();
  const universe = params.universe as string;
  const isEdit = mode === "edit";

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const form = useForm<DownloadFormValues>({
    resolver: zodResolver(downloadSchema),
    defaultValues: {
      handle: download?.handle ?? "",
      url: download?.url ?? "",
      filenameExt: download?.filenameExt ?? "xlsx",
      dateSensitive: download?.dateSensitive ?? false,
      freezeFile: download?.freezeFile ?? false,
      sort1: download?.sort1 ?? null,
      sort2: download?.sort2 ?? null,
      fileToExtract: download?.fileToExtract ?? "",
      sheetOverride: download?.sheetOverride ?? "",
      postParameters: download?.postParameters ?? "",
      notes: download?.notes ?? "",
    },
  });

  async function onSubmit(values: DownloadFormValues) {
    const payload = {
      handle: values.handle || null,
      url: values.url || null,
      filenameExt: values.filenameExt || null,
      dateSensitive: values.dateSensitive,
      freezeFile: values.freezeFile,
      sort1: values.sort1,
      sort2: values.sort2,
      fileToExtract: values.fileToExtract || null,
      sheetOverride: values.sheetOverride || null,
      postParameters: values.postParameters || null,
      notes: values.notes || null,
    };

    try {
      if (isEdit) {
        await updateDownloadAction(download!.id, payload);
        toast.success("Download updated");
        router.push(`/udaman/${universe}/downloads/${download!.id}`);
      } else {
        const result = await createDownloadAction(payload);
        toast.success("Download created");
        router.push(`/udaman/${universe}/downloads/${result.id}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      if (msg.includes("Duplicate entry")) {
        form.setError("handle", { message: "A download with this handle already exists" });
      } else {
        toast.error(msg);
      }
    }
  }

  async function handleDelete() {
    try {
      await deleteDownloadAction(download!.id);
      toast.success("Download deleted");
      router.push(`/udaman/${universe}/downloads`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg">
      <FieldSet>
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.handle}>
            <FieldLabel htmlFor="handle">Handle *</FieldLabel>
            <Input
              id="handle"
              placeholder="e.g. BLS_CPI"
              className="font-mono"
              {...form.register("handle")}
            />
            <FieldDescription>
              Unique identifier for this download. Use date format codes (%Y, %m, %b) for date-sensitive handles.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.handle]} />
          </Field>

          <div className="flex items-center gap-6">
            <Field orientation="horizontal">
              <Checkbox
                id="dateSensitive"
                checked={form.watch("dateSensitive")}
                onCheckedChange={(checked) =>
                  form.setValue("dateSensitive", checked === true)
                }
              />
              <FieldLabel htmlFor="dateSensitive">Date sensitive</FieldLabel>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="freezeFile"
                checked={form.watch("freezeFile")}
                onCheckedChange={(checked) =>
                  form.setValue("freezeFile", checked === true)
                }
              />
              <FieldLabel htmlFor="freezeFile">Freeze file</FieldLabel>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="sort1">Sort 1</FieldLabel>
              <Input
                id="sort1"
                type="number"
                value={form.watch("sort1") ?? ""}
                onChange={(e) =>
                  form.setValue("sort1", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sort2">Sort 2</FieldLabel>
              <Input
                id="sort2"
                type="number"
                value={form.watch("sort2") ?? ""}
                onChange={(e) =>
                  form.setValue("sort2", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
          </div>

          <Field data-invalid={!!form.formState.errors.url}>
            <FieldLabel htmlFor="url">URL</FieldLabel>
            <Input
              id="url"
              placeholder="https://..."
              {...form.register("url")}
            />
            <FieldError errors={[form.formState.errors.url]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="filenameExt">File type</FieldLabel>
            <Select
              value={form.watch("filenameExt")}
              onValueChange={(value) => form.setValue("filenameExt", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                {filenameExtOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="fileToExtract">File to extract</FieldLabel>
            <Input
              id="fileToExtract"
              placeholder="filename inside zip archive"
              {...form.register("fileToExtract")}
            />
            <FieldDescription>
              For zip files: the specific file to extract from the archive.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="sheetOverride">Sheet override</FieldLabel>
            <Input
              id="sheetOverride"
              placeholder="sheet name"
              {...form.register("sheetOverride")}
            />
            <FieldDescription>
              Override the default sheet name when reading Excel files.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="postParameters">POST parameters</FieldLabel>
            <Textarea
              id="postParameters"
              rows={3}
              className="font-mono text-sm"
              placeholder="key=value&key2=value2"
              {...form.register("postParameters")}
            />
            <FieldDescription>
              For POST requests. One parameter per line or URL-encoded format.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Any notes about this download..."
              {...form.register("notes")}
            />
          </Field>
        </FieldGroup>

        <div className="mt-6 flex flex-row items-center gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Saving..."
              : isEdit
                ? "Update download"
                : mode === "duplicate"
                  ? "Duplicate download"
                  : "Create download"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </FieldSet>

      {isEdit && (
        <DeleteDownloadDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          handle={download?.handle ?? null}
          onConfirm={handleDelete}
        />
      )}
    </form>
  );
}
