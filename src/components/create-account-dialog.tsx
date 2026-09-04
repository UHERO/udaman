"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { createUserAction } from "@/actions/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  canUseGoogleLogin,
  passwordRequirementHint,
} from "@/lib/auth/google-login";
import {
  INVITE_ROLES,
  NEW_USER_UNIVERSE,
  ROLE_DESCRIPTIONS,
  type Role,
} from "@/lib/auth/roles";

const DEFAULT_ROLE: Role = "fellow";

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Must be a valid email"),
    role: z.custom<Role>((v) => INVITE_ROLES.includes(v as Role), {
      message: "Choose a role",
    }),
    password: z.string(),
    passwordConfirmation: z.string(),
  })
  .superRefine((data, ctx) => {
    // Google-capable addresses may skip the password; everyone else can't
    // sign in without one.
    if (data.password.length === 0) {
      if (!canUseGoogleLogin(data.email)) {
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

type FormValues = z.infer<typeof formSchema>;

/**
 * Quick account creation from the rail user menu (admin/dev only). Accounts
 * are never created on first sign-in, so this — along with /admin/users and
 * the whitelist import script — is how someone gets access. gmail.com and
 * hawaii.edu addresses sign in with UH Login and need no password; any other
 * address must be given one here.
 */
export function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: DEFAULT_ROLE,
      password: "",
      passwordConfirmation: "",
    },
  });
  const email = form.watch("email");
  const googleLogin = canUseGoogleLogin(email);

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const result = await createUserAction({
      email: values.email,
      name: values.name,
      role: values.role,
      universe: NEW_USER_UNIVERSE,
      ...(values.password ? { password: values.password } : {}),
    });
    if (result.success) {
      const how = canUseGoogleLogin(values.email)
        ? "UH Login"
        : "email and password";
      toast.success(
        `${result.message}. They can now sign in with ${how} as ${values.email.trim().toLowerCase()}.`,
      );
      handleOpenChange(false);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>
            Invite someone to UDAMAN. gmail.com and hawaii.edu addresses sign in
            with UH Login; other addresses need a password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldSet className="gap-2">
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="new-account-name">Name</FieldLabel>
                <Input
                  id="new-account-name"
                  autoComplete="off"
                  autoFocus
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="new-account-email">Email</FieldLabel>
                <Input
                  id="new-account-email"
                  type="email"
                  autoComplete="off"
                  placeholder="name@hawaii.edu"
                  {...form.register("email")}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.role}>
                <FieldLabel htmlFor="new-account-role">Role</FieldLabel>
                <Select
                  value={form.watch("role")}
                  onValueChange={(value) =>
                    form.setValue("role", value as Role)
                  }
                >
                  <SelectTrigger id="new-account-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {ROLE_DESCRIPTIONS[r]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Admin and dev roles are granted by a dev on the Users page.
                </p>
                <FieldError errors={[form.formState.errors.role]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="new-account-password">
                  Password{googleLogin ? " (optional)" : ""}
                </FieldLabel>
                <Input
                  id="new-account-password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register("password")}
                />
                <p className="text-muted-foreground text-xs">
                  {passwordRequirementHint(email)}
                </p>
                <FieldError errors={[form.formState.errors.password]} />
              </Field>

              <Field
                data-invalid={!!form.formState.errors.passwordConfirmation}
              >
                <FieldLabel htmlFor="new-account-password-confirmation">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="new-account-password-confirmation"
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

          <DialogFooter>
            <Button
              className="cursor-pointer"
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
