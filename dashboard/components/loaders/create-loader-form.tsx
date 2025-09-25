"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createDataLoader } from "@/actions/data-loaders";
import { zodResolver } from "@hookform/resolvers/zod";
import { Select } from "@radix-ui/react-select";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

import { Checkbox } from "../ui/checkbox";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const formSchema = z.object({
  code: z.string().min(2, {
    message: "Code is required.",
  }),
  priority: z
    .number()
    .min(0, {
      message: "Priorty must be a number between 0 and 100",
    })
    .max(100, {
      message: "Priorty must be a number between 0 and 100",
    }),
  scale: z.number(),
  presaveHook: z.string(),
  clearBeforeLoad: z.boolean(),
  pseudoHistory: z.boolean(),
});

export function CreateLoaderForm() {
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
    await createDataLoader({ universe: "UHERO", seriesId: 120349 }, values);
    nav.push(`/series/${seriesId}`);
  }

  const presaveHooks = ["update_full_years_top_priority"];

  return (
    <main className="m-4 max-w-md">
      <h1 className="mb-7 text-5xl font-bold text-gray-700">
        Add a new loader
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input placeholder="enter load statement" {...field} />
                </FormControl>
                <FormDescription>
                  Field will be evaluated as code to load data points
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem className="justify-start">
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} {...field} />
                  </FormControl>
                  <FormDescription>
                    Loader with higher priority take precedence. Avoid
                    duplicates
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scale"
              render={({ field }) => (
                <FormItem className="justify-start">
                  <FormLabel>Scale</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormDescription>
                    (multiply original data by: 0.001, 1, 1000, etc)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="presaveHook"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Presave hook</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={"1"}
                  >
                    <SelectTrigger className="min-w-sm">
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
                </FormControl>
                <FormDescription>
                  Method to be called prior to storing data points during load
                  operation
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clearBeforeLoad"
            render={({ field }) => (
              <FormItem className="flex flex-row">
                <FormControl>
                  <FormLabel>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(!field.value)
                      }
                    />
                    Always clear existing data points before loading
                  </FormLabel>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pseudoHistory"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <FormLabel>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(!field.value)
                      }
                    />
                    This load is pseudo-history
                  </FormLabel>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-row gap-x-4">
            <Button type="submit">Save loader</Button>
            <Button variant={"outline"} onClick={goBack}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </main>
  );
}
