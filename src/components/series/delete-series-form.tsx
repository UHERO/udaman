"use client";

import { isValidDate } from "@catalog/utils/time";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { deleteSeriesDataPoints } from "@/actions/series-actions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { H2 } from "../typography";

const formSchema = z.object({
  date: z.string().refine((val) => val === "" || isValidDate(val), {
    message: "Date is invalid",
  }),
  deleteBy: z.enum(["observationDate", "vintageDate", "none"]),
});

export function DeleteSeriesForm({
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
      date: "",
      deleteBy: "none",
    },
  });

  const deleteBy = form.watch("deleteBy");
  const disableDate = deleteBy === "none";

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    await deleteSeriesDataPoints(seriesId, { universe: universe, ...values });
    nav.push(`/${universe}/series/${seriesId}`);
  }

  return (
    <main className="m-4 max-w-md">
      <H2 className="mb-7">Clear Series Data</H2>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.deleteBy}>
              <FieldLabel>Clear data points by...</FieldLabel>
              <RadioGroup
                value={form.watch("deleteBy")}
                onValueChange={(value) =>
                  form.setValue(
                    "deleteBy",
                    value as "observationDate" | "vintageDate" | "none",
                  )
                }
                className="flex flex-col"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem
                    value="observationDate"
                    id="observationDate"
                  />
                  <FieldLabel
                    htmlFor="observationDate"
                    className="text-pretty font-normal"
                  >
                    <b>Observation date:</b> delete data points following given
                    date
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="vintageDate" id="vintageDate" />
                  <FieldLabel htmlFor="vintageDate" className="font-normal">
                    <b>Vintage:</b> delete data points loaded after given date
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="none" id="none" />
                  <FieldLabel htmlFor="none" className="font-normal">
                    <b>Neither:</b> clear all data points.
                  </FieldLabel>
                </Field>
              </RadioGroup>
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
