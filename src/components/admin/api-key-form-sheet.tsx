"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Universe, UNIVERSES } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import {
  createApiApplicationAction,
  updateApiApplicationAction,
} from "@/actions/api-applications";
import { Button } from "@/components/ui/button";
import {
  Field,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUniverseNames } from "@/hooks/use-universe-names";

interface ApiKeyData {
  id: number;
  universe: string;
  name: string | null;
  hostname: string | null;
  apiKey: string | null;
  githubNickname: string | null;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hostname: z.string(),
  apiKey: z.string(),
  githubNickname: z.string(),
  universe: z.enum(UNIVERSES),
});

interface ApiKeyFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  apiKey?: ApiKeyData | null;
}

export function ApiKeyFormSheet({
  open,
  onOpenChange,
  mode,
  apiKey,
}: ApiKeyFormSheetProps) {
  const router = useRouter();
  const universes = useUniverseNames();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      hostname: "",
      apiKey: "",
      githubNickname: "",
      universe: "UHERO",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: apiKey?.name ?? "",
        hostname: apiKey?.hostname ?? "",
        apiKey: apiKey?.apiKey ?? "",
        githubNickname: apiKey?.githubNickname ?? "",
        universe: (apiKey?.universe as Universe) ?? "UHERO",
      });
    }
  }, [open, apiKey, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const payload = {
        name: values.name || null,
        hostname: values.hostname || null,
        apiKey: values.apiKey || null,
        githubNickname: values.githubNickname || null,
        universe: values.universe,
      };

      if (mode === "create") {
        const result = await createApiApplicationAction(payload);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
          return;
        }
      } else if (apiKey) {
        const result = await updateApiApplicationAction(apiKey.id, payload);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
          return;
        }
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save API key",
      );
    }
  }

  const title = mode === "create" ? "Create API Key" : "Edit API Key";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to register a new API application."
              : "Update the API application details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="e.g. My App"
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.hostname}>
                <FieldLabel htmlFor="hostname">Hostname</FieldLabel>
                <Input
                  id="hostname"
                  placeholder="e.g. app.example.com"
                  {...form.register("hostname")}
                />
                <FieldError errors={[form.formState.errors.hostname]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.apiKey}>
                <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
                <Input
                  id="apiKey"
                  placeholder="e.g. abc123..."
                  {...form.register("apiKey")}
                />
                <FieldError errors={[form.formState.errors.apiKey]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.githubNickname}>
                <FieldLabel htmlFor="githubNickname">
                  GitHub Nickname
                </FieldLabel>
                <Input
                  id="githubNickname"
                  placeholder="e.g. octocat"
                  {...form.register("githubNickname")}
                />
                <FieldError errors={[form.formState.errors.githubNickname]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.universe}>
                <FieldLabel htmlFor="universe">Universe</FieldLabel>
                <Select
                  value={form.watch("universe")}
                  onValueChange={(value) =>
                    form.setValue("universe", value as Universe)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select universe" />
                  </SelectTrigger>
                  <SelectContent>
                    {universes.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.universe]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <SheetFooter className="mt-1">
            <Button
              className="cursor-pointer"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
