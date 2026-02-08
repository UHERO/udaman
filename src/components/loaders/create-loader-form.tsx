"use client";

import { Universe } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { createDataLoader } from "@/actions/data-loaders";
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

import { H2 } from "../typography";

const formSchema = z.object({
  code: z.string().min(2, {
    message: "Code is required.",
  }),
  priority: z
    .number()
    .min(0, {
      message: "Priority must be a number between 0 and 100",
    })
    .max(100, {
      message: "Priority must be a number between 0 and 100",
    }),
  scale: z.number(),
  presaveHook: z.string(),
  clearBeforeLoad: z.boolean(),
  pseudoHistory: z.boolean(),
});

export function CreateLoaderForm({ universe }: { universe: Universe }) {
  const queryParams = useSearchParams();
  const seriesId = queryParams.get("seriesId");

  const nav = useRouter();
  const goBack = () => nav.back();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      priority: 100,
      scale: 1.0,
      presaveHook: "",
      clearBeforeLoad: false,
      pseudoHistory: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await createDataLoader({ universe, seriesId: Number(seriesId) }, values);
    nav.push(`/${universe}/series/${seriesId}`);
  }

  const presaveHooks = ["update_full_years_top_priority"];

  return (
    <main className="m-4 max-w-md">
      <H2>Add a new loader</H2>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.code}>
              <FieldLabel htmlFor="code">Code</FieldLabel>
              <Input
                id="code"
                placeholder="enter load statement"
                aria-invalid={!!form.formState.errors.code}
                {...form.register("code")}
              />
              <FieldDescription>
                Field will be evaluated as code to load data points
              </FieldDescription>
              <FieldError errors={[form.formState.errors.code]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!form.formState.errors.priority}>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  max={100}
                  aria-invalid={!!form.formState.errors.priority}
                  {...form.register("priority", { valueAsNumber: true })}
                />
                <FieldDescription>
                  Loader with higher priority take precedence. Avoid duplicates
                </FieldDescription>
                <FieldError errors={[form.formState.errors.priority]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.scale}>
                <FieldLabel htmlFor="scale">Scale</FieldLabel>
                <Input
                  id="scale"
                  type="number"
                  min={0}
                  aria-invalid={!!form.formState.errors.scale}
                  {...form.register("scale", { valueAsNumber: true })}
                />
                <FieldDescription>
                  (multiply original data by: 0.001, 1, 1000, etc)
                </FieldDescription>
                <FieldError errors={[form.formState.errors.scale]} />
              </Field>
            </div>

            <Field data-invalid={!!form.formState.errors.presaveHook}>
              <FieldLabel htmlFor="presaveHook">Presave hook</FieldLabel>
              <Controller
                name="presaveHook"
                control={form.control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue="1"
                  >
                    <SelectTrigger id="presaveHook" className="min-w-sm">
                      <SelectValue placeholder="Select hook (this is uncommon)" />
                    </SelectTrigger>
                    <SelectContent>
                      {presaveHooks.map((m, index) => (
                        <SelectItem key={m} value={(index + 1).toString()}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                Method to be called prior to storing data points during load
                operation
              </FieldDescription>
              <FieldError errors={[form.formState.errors.presaveHook]} />
            </Field>

            <Field
              orientation="horizontal"
              data-invalid={!!form.formState.errors.clearBeforeLoad}
            >
              <Controller
                name="clearBeforeLoad"
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    id="clearBeforeLoad"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="clearBeforeLoad">
                Always clear existing data points before loading
              </FieldLabel>
              <FieldError errors={[form.formState.errors.clearBeforeLoad]} />
            </Field>

            <Field
              orientation="horizontal"
              data-invalid={!!form.formState.errors.pseudoHistory}
            >
              <Controller
                name="pseudoHistory"
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    id="pseudoHistory"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="pseudoHistory">
                This load is pseudo-history
              </FieldLabel>
              <FieldError errors={[form.formState.errors.pseudoHistory]} />
            </Field>
          </FieldGroup>

          <div className="mt-8 flex flex-row gap-x-4">
            <Button type="submit">Save loader</Button>
            <Button type="button" variant="outline" onClick={goBack}>
              Cancel
            </Button>
          </div>
        </FieldSet>
      </form>
    </main>
  );
}
