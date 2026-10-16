"use client";

import { useForm } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import type {
  DownloaderFormData,
  IngestFormOptions,
} from "@catalog/controllers/ingest";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { saveDownloaderAction } from "@/actions/ingest-actions";
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
import { toastActionError, unwrapAction } from "@/lib/action-result";

const NONE = "__none__";

const jsonObject = z.string().refine((v) => {
  if (!v.trim()) return true;
  try {
    const parsed = JSON.parse(v) as unknown;
    return (
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}, "Config must be a JSON object");

const schema = z.object({
  handle: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]{1,63}$/,
      "lowercase letters, digits and _, starting with a letter",
    ),
  strategy: z.string().min(1),
  sourceKey: z.string(),
  schedule: z.string(),
  enabled: z.boolean(),
  config: jsonObject,
  notes: z.string(),
});

type Values = z.infer<typeof schema>;

const CONFIG_HINTS: Record<string, string> = {
  static_url:
    '{ "url": "https://…/%Y.xls", "periods": { "frequency": "year", "start": "2009" }, "key": "%Y", "liveRecent": 2 } — periods optional',
  discover_from_page:
    '{ "page": "https://…", "via": [{ "text": "^Reports$" }], "link": { "text": "Jobs", "href": "\\\\.xlsx?$" }, "multiple": false }',
  custom: "Whatever the source module reads (see its fetch.ts).",
};

export function DownloaderForm({
  downloader,
  options,
}: {
  downloader?: DownloaderFormData;
  options: IngestFormOptions;
}) {
  const router = useRouter();
  const universe = useParams().universe as string;
  const isEdit = Boolean(downloader);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      handle: downloader?.handle ?? "",
      strategy: downloader?.strategy ?? "static_url",
      sourceKey: downloader?.sourceKey ?? NONE,
      schedule: downloader?.schedule ?? "",
      enabled: downloader?.enabled ?? true,
      config: downloader?.config ?? "{}",
      notes: downloader?.notes ?? "",
    },
  });
  const strategy = form.watch("strategy");
  const sourceChoices =
    strategy === "custom" ? options.fetchSourceKeys : options.sourceKeys;

  async function onSubmit(v: Values) {
    try {
      const res = unwrapAction(
        await saveDownloaderAction(downloader?.handle ?? null, {
          handle: v.handle,
          strategy: v.strategy,
          sourceKey: v.sourceKey === NONE ? null : v.sourceKey,
          schedule: v.schedule.trim() || null,
          enabled: v.enabled,
          config: v.config,
          notes: v.notes || null,
        }),
      );
      toast.success(res.message);
      router.push(`/udaman/${universe}/ingest/downloaders/${res.handle}`);
      router.refresh();
    } catch (e) {
      toastActionError(e, "Save failed");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl">
      <FieldSet>
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.handle}>
            <FieldLabel htmlFor="handle">Handle</FieldLabel>
            <Input
              id="handle"
              className="font-mono"
              disabled={isEdit}
              {...form.register("handle")}
            />
            <FieldDescription>
              Names the downloader in extractor inputs and file paths; it cannot
              change later.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.handle]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="strategy">Fetch strategy</FieldLabel>
            <Select
              value={strategy}
              onValueChange={(v) => form.setValue("strategy", v)}
            >
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.strategies.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              static_url and discover_from_page need config only; custom runs
              the source module&apos;s fetch().
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="sourceKey">Source module</FieldLabel>
            <Select
              value={form.watch("sourceKey")}
              onValueChange={(v) => form.setValue("sourceKey", v)}
            >
              <SelectTrigger id="sourceKey">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {strategy !== "custom" && (
                  <SelectItem value={NONE}>(none)</SelectItem>
                )}
                {sourceChoices.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              src/core/ingest/sources/&lt;key&gt;. Required for custom.
            </FieldDescription>
          </Field>

          <Field data-invalid={!!form.formState.errors.schedule}>
            <FieldLabel htmlFor="schedule">Schedule</FieldLabel>
            <Input
              id="schedule"
              className="font-mono"
              placeholder="10 5 * * *"
              {...form.register("schedule")}
            />
            <FieldDescription>
              Cron, Hawaii time (minute hour day month weekday). Blank = manual
              runs only. Schedules run in production only.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="enabled"
              checked={form.watch("enabled")}
              onCheckedChange={(c) => form.setValue("enabled", c === true)}
            />
            <FieldLabel htmlFor="enabled">Enabled</FieldLabel>
          </Field>

          <Field data-invalid={!!form.formState.errors.config}>
            <FieldLabel htmlFor="config">Config (JSON)</FieldLabel>
            <Textarea
              id="config"
              rows={8}
              className="font-mono text-sm"
              {...form.register("config")}
            />
            <FieldDescription className="font-mono text-xs">
              {CONFIG_HINTS[strategy]}
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
                ? "Save downloader"
                : "Create downloader"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
        {isEdit && (
          <p className="text-muted-foreground mt-4 text-xs">
            A downloader with stored files can&apos;t be deleted (its history
            stays); disable it instead.
          </p>
        )}
      </FieldSet>
    </form>
  );
}
