"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import type {
  ExtractorFormData,
  IngestFormOptions,
} from "@catalog/controllers/ingest";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { saveExtractorAction } from "@/actions/ingest-actions";
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

const schema = z.object({
  handle: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]{1,63}$/,
      "lowercase letters, digits and _, starting with a letter",
    ),
  sourceKey: z.string().min(1, "Pick a parser"),
  enabled: z.boolean(),
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
  notes: z.string(),
  inputs: z
    .array(z.object({ downloader: z.string().min(1), role: z.string() }))
    .min(1, "Add at least one input downloader"),
});

type Values = z.infer<typeof schema>;

export function ExtractorForm({
  extractor,
  options,
}: {
  extractor?: ExtractorFormData;
  options: IngestFormOptions;
}) {
  const router = useRouter();
  const universe = useParams().universe as string;
  const isEdit = Boolean(extractor);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      handle: extractor?.handle ?? "",
      sourceKey: extractor?.sourceKey ?? "",
      enabled: extractor?.enabled ?? true,
      config: extractor?.config ?? "{}",
      notes: extractor?.notes ?? "",
      inputs: extractor?.inputs.map((i) => ({
        downloader: i.downloader,
        role: i.role ?? "",
      })) ?? [{ downloader: options.downloaders[0] ?? "", role: "" }],
    },
  });
  const inputs = useFieldArray({ control: form.control, name: "inputs" });

  async function onSubmit(v: Values) {
    try {
      const res = unwrapAction(
        await saveExtractorAction(extractor?.handle ?? null, {
          handle: v.handle,
          sourceKey: v.sourceKey,
          enabled: v.enabled,
          config: v.config,
          notes: v.notes || null,
          inputs: v.inputs.map((i) => ({
            downloader: i.downloader,
            role: i.role.trim() || null,
          })),
        }),
      );
      toast.success(res.message);
      router.push(`/udaman/${universe}/ingest/extractors/${res.handle}`);
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
              Load statements name it:{" "}
              <code>Series.load_from_extract(&quot;handle&quot;, …)</code>. It
              cannot change later.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.handle]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.sourceKey}>
            <FieldLabel htmlFor="sourceKey">Parser (source module)</FieldLabel>
            <Select
              value={form.watch("sourceKey")}
              onValueChange={(v) => form.setValue("sourceKey", v)}
            >
              <SelectTrigger id="sourceKey">
                <SelectValue placeholder="Select a parser" />
              </SelectTrigger>
              <SelectContent>
                {options.sourceKeys.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              src/core/ingest/sources/&lt;key&gt;/parse.ts. Several extractors
              may share one parser with different config.
            </FieldDescription>
            <FieldError errors={[form.formState.errors.sourceKey]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.inputs}>
            <FieldLabel>Input downloaders</FieldLabel>
            <div className="flex flex-col gap-2">
              {inputs.fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Select
                    value={form.watch(`inputs.${i}.downloader`)}
                    onValueChange={(v) =>
                      form.setValue(`inputs.${i}.downloader`, v)
                    }
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="downloader" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.downloaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="role (optional)"
                    className="w-40"
                    {...form.register(`inputs.${i}.role`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={inputs.fields.length === 1}
                    onClick={() => inputs.remove(i)}
                  >
                    remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  inputs.append({
                    downloader: options.downloaders[0] ?? "",
                    role: "",
                  })
                }
              >
                Add input
              </Button>
            </div>
            <FieldDescription>
              The parser reads the newest stored version of every file of these
              downloaders. A role tells inputs apart (e.g. current, archive).
            </FieldDescription>
            <FieldError
              errors={[
                form.formState.errors.inputs as
                  { message?: string } | undefined,
              ]}
            />
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
              rows={6}
              className="font-mono text-sm"
              {...form.register("config")}
            />
            <FieldDescription className="font-mono text-xs">
              {
                '{ "checks": { "allowDisappeared": false, "maxChange": 0.5, "minDate": "1990-01-01" } } plus whatever the parser reads'
              }
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
                ? "Save extractor"
                : "Create extractor"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </FieldSet>
    </form>
  );
}
