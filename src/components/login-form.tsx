"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { H1, Lead } from "./typography";

export function LoginForm({
  callbackUrl,
  className,
  ...props
}: React.ComponentProps<"form"> & {
  /** Where to send the user after sign-in; defaults to their landing page. */
  callbackUrl?: string;
}) {
  const router = useRouter();
  // /udaman redirects a signed-in user to their role/universe landing page.
  const destination = callbackUrl ?? "/udaman";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  // Nearly everyone has a hawaii.edu account, so password login stays tucked
  // away until asked for.
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push(destination);
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <H1>UDAMAN</H1>
        <Lead className="text-2xl">UHERO Data Manager</Lead>
      </div>
      <div className="grid gap-6">
        <Button
          type="button"
          className="w-full"
          disabled={isPending}
          onClick={() => signIn("google", { callbackUrl: destination })}
        >
          UH Login
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Sign in with your hawaii.edu account.
        </p>

        {showPassword ? (
          <>
            <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
              <span className="bg-background text-muted-foreground relative z-10 px-2">
                Or sign in with a password
              </span>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="piko@puka.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <div className="grid gap-3">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <a
                  href="#"
                  onClick={() => toast.info("Not yet implemented")}
                  className="ml-auto text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              variant="outline"
              disabled={isPending}
              className="w-full"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Login
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline"
          >
            Non-UH account? Sign in with email and password
          </button>
        )}
      </div>
    </form>
  );
}
