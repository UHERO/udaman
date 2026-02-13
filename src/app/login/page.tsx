import { redirect } from "next/navigation";
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
    redirect(callbackUrl ?? "/udaman/UHERO/series");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm callbackUrl={callbackUrl} error={error} />
    </div>
  );
}
