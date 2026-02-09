"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { H2 } from "../typography";

const formSchema = z.object({
  name: z.string(),
  geography: z.string(),
  frequency: z.string(),
  dataPortalName: z.string(),
  description: z.string(),
  unit: z.string(),
  source: z.string(),
  sourceLink: z.string(),
  sourceDetail: z.string(),
  investigationNotes: z.string(),
  decimals: z.number(),
  percent: z.boolean(),
  real: z.boolean(),
  seasonalAdjustment: z.string(),
  frequencyTransformationMethod: z.string(),
  restricted: z.boolean(),
});

export function SeriesCreateForm({
  seriesId,
  universe,
}: {
  seriesId: number;
  universe: string;
}) {
  const nav = useRouter();
  const goBack = () => nav.back();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      geography: "",
      frequency: "",
      dataPortalName: "",
      description: "",
      unit: "",
      source: "",
      sourceLink: "",
      sourceDetail: "",
      investigationNotes: "",
      decimals: 1,
      percent: false,
      real: false,
      seasonalAdjustment: "NA", // SA, NS, NA
      frequencyTransformationMethod: "sum", // check enum
      restricted: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);

    nav.push(`/${universe}/series/${seriesId}`);
  }

  return (
    <main className="m-4 max-w-md">
      <H2 className="mb-7">Create New Series</H2>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.deleteBy}>
              <FieldLabel>Label</FieldLabel>

              <FieldError errors={[form.formState.errors.deleteBy]} />
            </Field>

            <Field
              data-invalid={!!form.formState.errors.date}
              className={cn(disableDate && "opacity-50")}
            >
              <FieldLabel htmlFor="date">
                Date <span className="text-xs text-slate-500">YYYY-MM-DD</span>
              </FieldLabel>
              <Input
                id="date"
                disabled={disableDate}
                placeholder="YYYY-MM-DD"
                aria-invalid={!!form.formState.errors.date}
                {...form.register("date")}
              />
              <FieldDescription>
                Clear data points relative to the following date or leave blank
                to delete all data points.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.date]} />
            </Field>
          </FieldGroup>

          <div className="mt-8 flex flex-row gap-x-4">
            <Button type="submit">Clear datapoints</Button>
            <Button type="button" variant={"outline"} onClick={goBack}>
              Cancel
            </Button>
          </div>
        </FieldSet>
      </form>
    </main>
  );
}
