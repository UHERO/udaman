"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { deleteSeriesDataPoints } from "@/actions/series-actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { isValidDate } from "@shared/utils/time";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

const formSchema = z.object({
  date: z.string().refine((val) => val === "" || isValidDate(val), {
    message: "Date is invalid",
  }),
  deleteBy: z.enum(["observationDate", "vintageDate", "none"]),
});

export function DeleteSeriesForm({ seriesId }: { seriesId: number }) {
  const queryParams = useSearchParams();
  const universe = queryParams.get("u") ?? "UHERO";
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
    nav.push(`/series/${seriesId}`);
  }

  return (
    <main className="m-4 max-w-md">
      <h1 className="mb-7 text-5xl font-bold text-gray-700">
        Clear Series Data
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="deleteBy"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Clear data points by...</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-col"
                  >
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <RadioGroupItem value="observationDate" />
                      </FormControl>
                      <FormLabel className="w-fit font-normal text-pretty">
                        <b>Observation date:</b> delete data points following
                        given date
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <RadioGroupItem value="vintageDate" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        <b>Vintage:</b> delete data points loaded after given
                        date
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <RadioGroupItem value="none" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        <b>Neither:</b> clear all data points.
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className={cn(disableDate && "opacity-50")}>
                <FormLabel>
                  Date{" "}
                  <span className="text-xs text-slate-500">YYYY-MM-DD</span>
                </FormLabel>
                <FormControl>
                  <Input
                    disabled={disableDate}
                    placeholder="YYYY-MM-DD"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Clear data points relative to the following date or leave
                  blank to delete all data points.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-row gap-x-4">
            <Button type="submit">Clear datapoints</Button>
            <Button type="button" variant={"outline"} onClick={goBack}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </main>
  );
}
