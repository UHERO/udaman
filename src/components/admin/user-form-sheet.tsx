"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createUserAction, updateUserAction } from "@/actions/users";
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
import {
  canUseGoogleLogin,
  passwordRequirementHint,
} from "@/lib/auth/google-login";
import {
  ALL_ROLES,
  NEW_USER_ROLE,
  NEW_USER_UNIVERSE,
  ROLE_DESCRIPTIONS,
} from "@/lib/auth/roles";

const ROLES = ALL_ROLES;

export type SerializedUser = {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  universe: string | null;
  /** Most recent page view — the real "when were they last using it". */
  lastActiveAt: string | null;
  /** Devise Trackable: `current*` is this sign-in, `last*` the one before. */
  signInCount: number;
  currentSignInAt: string | null;
  currentSignInIp: string | null;
  lastSignInAt: string | null;
  lastSignInIp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** When editing, a blank password leaves the existing one alone. When
 *  creating, it may be blank only for addresses that can use UH Google login
 *  (gmail.com, hawaii.edu); any other address needs a password to sign in. */
function buildFormSchema(isEdit: boolean) {
  return z
    .object({
      email: z.string().email("Must be a valid email"),
      name: z.string(),
      role: z.enum(ROLES),
      universe: z.string().min(1, "Universe is required"),
      password: z.string(),
      passwordConfirmation: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.password.length === 0) {
        if (!isEdit && !canUseGoogleLogin(data.email)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: "A password is required for this email address",
          });
        }
        return;
      }

      if (data.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must be at least 8 characters",
        });
      }
      if (data.password !== data.passwordConfirmation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passwordConfirmation"],
          message: "Passwords do not match",
        });
      }
    });
}

type FormValues = {
  email: string;
  name: string;
  role: (typeof ROLES)[number];
  universe: string;
  password: string;
  passwordConfirmation: string;
};

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a user to edit it; omit to create a new one. */
  user?: SerializedUser | null;
}

export function UserFormSheet({
  open,
  onOpenChange,
  user,
}: UserFormSheetProps) {
  const router = useRouter();
  const universes = useUniverseNames();
  const isEdit = !!user;

  const schema = useMemo(() => buildFormSchema(isEdit), [isEdit]);

  const defaults: FormValues = useMemo(
    () => ({
      email: user?.email ?? "",
      name: user?.name ?? "",
      role: (user?.role as (typeof ROLES)[number]) ?? NEW_USER_ROLE,
      universe: user?.universe ?? NEW_USER_UNIVERSE,
      password: "",
      passwordConfirmation: "",
    }),
    [user],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  async function onSubmit(values: FormValues) {
    try {
      const result =
        user != null
          ? await updateUserAction(user.id, {
              email: values.email.trim(),
              name: values.name.trim() || null,
              role: values.role,
              universe: values.universe,
              // Blank means "keep the current password".
              ...(values.password ? { password: values.password } : {}),
            })
          : await createUserAction({
              email: values.email.trim(),
              name: values.name.trim() || null,
              role: values.role,
              universe: values.universe,
              // Blank means "UH Google login only".
              ...(values.password ? { password: values.password } : {}),
            });

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : `Failed to ${isEdit ? "update" : "create"} user`,
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pt-3 pb-0">
          <SheetTitle>{isEdit ? "Edit User" : "Create User"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this account. Leave the password fields blank to keep the current password."
              : "Create a new account. gmail.com and hawaii.edu addresses sign in with UH Login and need no password; other addresses require one."}
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
                      <SelectItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {ROLE_DESCRIPTIONS[r]}
                        </span>
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
                <FieldLabel htmlFor="password">
                  {isEdit
                    ? "New Password"
                    : canUseGoogleLogin(form.watch("email"))
                      ? "Password (optional)"
                      : "Password"}
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={isEdit ? "Leave blank to keep current" : ""}
                  {...form.register("password")}
                />
                {!isEdit && (
                  <p className="text-muted-foreground text-xs">
                    {passwordRequirementHint(form.watch("email"))}
                  </p>
                )}
                <FieldError errors={[form.formState.errors.password]} />
              </Field>

              <Field
                data-invalid={!!form.formState.errors.passwordConfirmation}
              >
                <FieldLabel htmlFor="passwordConfirmation">
                  {isEdit ? "Confirm New Password" : "Confirm Password"}
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
              {form.formState.isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save"
                  : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
