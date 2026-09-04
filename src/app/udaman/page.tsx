import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { GalleryVerticalEnd } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { NoAccountDialog } from "@/components/no-account-dialog";
import { SurfWidget } from "@/components/surf-widget";
import { getLandingPath } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/dal";
import { NO_ACCOUNT_ERROR } from "@/lib/auth/index";

/**
 * Only follow same-site relative paths. Anything else (absolute URLs,
 * protocol-relative `//evil.com`) is dropped so login can't be used as an
 * open redirect.
 */
function safeCallbackUrl(raw: string | undefined): string | undefined {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const noAccount = params.error === NO_ACCOUNT_ERROR;

  if (session?.user) {
    const universe = session.user.universe ?? "UHERO";
    const role = session.user.role ?? "external";
    redirect(callbackUrl ?? getLandingPath(role, universe));
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            UHERO
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm callbackUrl={callbackUrl} />
          </div>
        </div>
        {noAccount && <NoAccountDialog />}
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src="/turtle-01-ishan-mons.JPG"
          alt="Image"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
        <Suspense>
          <SurfWidget />
        </Suspense>
      </div>
    </div>
  );
}
