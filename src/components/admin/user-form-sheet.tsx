"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createUserAction } from "@/actions/users";
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

const ROLES = ["external", "fsonly", "internal", "admin", "dev"] as const;

const formSchema = z
  .object({
    email: z.string().email("Must be a valid email"),
    name: z.string(),
    role: z.enum(ROLES),
    universe: z.string().min(1, "Universe is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof formSchema>;

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheet({ open, onOpenChange }: UserFormSheetProps) {
  const router = useRouter();
  const universes = useUniverseNames();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "external",
      universe: "UHERO",
      password: "",
      passwordConfirmation: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: "",
        name: "",
        role: "external",
        universe: "UHERO",
        password: "",
        passwordConfirmation: "",
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    try {
      const result = await createUserAction({
        email: values.email.trim(),
        name: values.name.trim() || null,
        role: values.role,
        universe: values.universe,
        password: values.password,
      });
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>Create User</SheetTitle>
          <SheetDescription>
            Fill in the details to create a new user account.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-0 overflow-y-auto px-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  autoFocus
                  autoComplete="off"
                  {...form.register("email")}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="Full name"
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.role}>
                <FieldLabel htmlFor="role">Role</FieldLabel>
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) =>
                    form.setValue("role", value as (typeof ROLES)[number])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.role]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.universe}>
                <FieldLabel htmlFor="universe">Universe</FieldLabel>
                <Select
                  value={form.watch("universe")}
                  onValueChange={(value) => form.setValue("universe", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select universe" />
                  </SelectTrigger>
                  <SelectContent>
                    {universes.map((u, i) => (
                      <SelectItem key={`${i}-${u}`} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.universe]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("password")}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>

              <Field
                data-invalid={!!form.formState.errors.passwordConfirmation}
              >
                <FieldLabel htmlFor="passwordConfirmation">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("passwordConfirmation")}
                />
                <FieldError
                  errors={[form.formState.errors.passwordConfirmation]}
                />
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
              {form.formState.isSubmitting ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
