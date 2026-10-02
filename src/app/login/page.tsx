import { redirect } from "next/navigation";

import { getLandingPath } from "@/lib/auth/authorization";
import { auth } from "@/lib/auth/index";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  // Already logged in — redirect to callback or default
  if (session?.user) {
    const universe = session.user.universe ?? "UHERO";
    const role = session.user.role ?? "external";
    redirect(callbackUrl ?? getLandingPath(role, universe));
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm callbackUrl={callbackUrl} error={error} />
    </div>
  );
}
