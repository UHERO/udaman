"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import type { DownloaderFormData } from "@catalog/controllers/downloaders";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import {
  createDownloaderAction,
  deleteDownloaderAction,
  updateDownloaderAction,
} from "@/actions/downloader-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const schema = z.object({
  handle: z.string().min(1, "Pick an implementation"),
  config: z.string().refine((v) => {
    if (!v.trim()) return true;
    try {
      const parsed = JSON.parse(v) as unknown;
      return (
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      );
    } catch {
      return false;
    }
  }, "Config must be a JSON object"),
  enabled: z.boolean(),
  maxAgeMinutes: z.number().int().positive().nullable(),
  notes: z.string(),
});

type Values = z.infer<typeof schema>;

export function DownloaderForm({
  downloader,
  handles = [],
}: {
  downloader?: DownloaderFormData;
  /** Registered implementations without a row (create mode) */
  handles?: string[];
}) {
  const router = useRouter();
  const params = useParams();
  const universe = params.universe as string;
  const isEdit = Boolean(downloader?.id);
  const [showDelete, setShowDelete] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      handle: downloader?.handle ?? handles[0] ?? "",
      config: downloader?.config ?? "{}",
      enabled: downloader?.enabled ?? true,
      maxAgeMinutes: downloader ? downloader.maxAgeMinutes : 1440,
      notes: downloader?.notes ?? "",
    },
  });

  async function onSubmit(v: Values) {
    const config = v.config.trim()
      ? (JSON.parse(v.config) as Record<string, unknown>)
      : null;
    try {
      const res = isEdit
        ? await updateDownloaderAction(downloader!.id!, {
            config,
            enabled: v.enabled,
            maxAgeMinutes: v.maxAgeMinutes,
            notes: v.notes || null,
          })
        : await createDownloaderAction({
            handle: v.handle,
            config,
            enabled: v.enabled,
            maxAgeMinutes: v.maxAgeMinutes,
            notes: v.notes || null,
          });
      toast.success(res.message);
      router.push(`/udaman/${universe}/downloaders/${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function onDelete() {
    try {
      const res = await deleteDownloaderAction(downloader!.id!);
      toast.success(res.message);
      router.push(`/udaman/${universe}/downloaders`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg">
      <FieldSet>
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.handle}>
            <FieldLabel htmlFor="handle">Implementation</FieldLabel>
            {isEdit ? (
              <Input
                id="handle"
                value={downloader!.handle}
                disabled
                className="font-mono"
              />
            ) : handles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Every registered downloader already has a row.
              </p>
            ) : (
              <Select
                value={form.watch("handle")}
                onValueChange={(v) => form.setValue("handle", v)}
              >
                <SelectTrigger id="handle">
                  <SelectValue placeholder="Select a downloader" />
                </SelectTrigger>
                <SelectContent>
                  {handles.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldDescription>
              The code lives in src/core/downloaders; a row configures it.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.handle]} />
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="enabled"
              checked={form.watch("enabled")}
              onCheckedChange={(c) => form.setValue("enabled", c === true)}
            />
            <FieldLabel htmlFor="enabled">Enabled</FieldLabel>
          </Field>

          <Field data-invalid={!!form.formState.errors.maxAgeMinutes}>
            <FieldLabel htmlFor="maxAgeMinutes">Max age (minutes)</FieldLabel>
            <Input
              id="maxAgeMinutes"
              type="number"
              value={form.watch("maxAgeMinutes") ?? ""}
              onChange={(e) =>
                form.setValue(
                  "maxAgeMinutes",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
            <FieldDescription>
              A load statement refreshes the output first when it is older than
              this. Blank = only scheduled and manual runs refresh it.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.maxAgeMinutes]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.config}>
            <FieldLabel htmlFor="config">Config (JSON)</FieldLabel>
            <Textarea
              id="config"
              rows={6}
              className="font-mono text-sm"
              {...form.register("config")}
            />
            <FieldDescription>
              bls_api: refetchYears · dotax_current: liveYears, failOnProblems ·
              dotax_archive: firstMonth, failOnProblems · dotax_sheet: sheetId,
              range
            </FieldDescription>
            <FieldError errors={[form.formState.errors.config]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </Field>
        </FieldGroup>

        <div className="mt-6 flex flex-row items-center gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Saving..."
              : isEdit
                ? "Update downloader"
                : "Create downloader"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setShowDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </FieldSet>

      {isEdit && (
        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete downloader</AlertDialogTitle>
              <AlertDialogDescription>
                Delete{" "}
                <strong className="font-mono">{downloader!.handle}</strong>? Its
                source and output Downloads are kept (unlinked), and load
                statements that use it will fail until it is recreated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  );
}
