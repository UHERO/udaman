/**
 * OAuth consent page. /api/oauth/authorize redirects a signed-in user here
 * (carrying the original query string) instead of issuing a code outright.
 * The page names the client, shows who is signed in, and requires an explicit
 * Allow before any code is issued — so a link to /authorize that someone was
 * tricked into clicking can't hand their access to an unknown client.
 *
 * Allow and Deny are server actions in src/actions/oauth-consent.ts. The
 * page does not trust the query string: the client must exist and the
 * redirect_uri must be registered for it, or an error card is shown instead.
 */

import { redirect } from "next/navigation";
import OAuthClientCollection from "@catalog/collections/oauth-client-collection";
import { ShieldCheck } from "lucide-react";

import { allowConsent, denyConsent } from "@/actions/oauth-consent";
import { H1, Lead } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

type Query = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  error?: string;
};

const ERROR_TEXT: Record<string, string> = {
  invalid_client: "This client is not registered with UDAMAN.",
  invalid_request: "The authorization request was malformed.",
  server_error: "Something went wrong while processing the request.",
};

function ErrorCard({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <H1>Can&apos;t continue</H1>
      <p className="text-muted-foreground text-sm">
        {ERROR_TEXT[code] ??
          "The authorization request could not be completed."}
      </p>
      <p className="text-muted-foreground text-xs">
        You can close this window and try connecting again.
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const q = await searchParams;

  if (q.error) {
    return (
      <Shell>
        <ErrorCard code={q.error} />
      </Shell>
    );
  }

  const clientId = q.client_id ?? "";
  const redirectUri = q.redirect_uri ?? "";
  if (!clientId || !redirectUri || q.response_type !== "code") {
    return (
      <Shell>
        <ErrorCard code="invalid_request" />
      </Shell>
    );
  }

  // Not signed in: go to login, then straight back into the authorize flow
  // (which lands here again once there is a session).
  const session = await getSession();
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
    const back = `/api/oauth/authorize?${params.toString()}`;
    redirect(`/udaman?callbackUrl=${encodeURIComponent(back)}`);
  }

  const client = await OAuthClientCollection.getByClientId(clientId);
  if (!client) {
    return (
      <Shell>
        <ErrorCard code="invalid_client" />
      </Shell>
    );
  }
  if (!client.redirectUriAllowed(redirectUri)) {
    return (
      <Shell>
        <ErrorCard code="invalid_request" />
      </Shell>
    );
  }

  const clientName = client.clientName?.trim() || "Unknown client";
  let redirectHost = redirectUri;
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {
    // leave as-is; the collection already validated it as a URL on register
  }
  const email = session.user.email ?? "your account";

  const hidden = {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: q.code_challenge ?? "",
    code_challenge_method: q.code_challenge_method ?? "",
    state: q.state ?? "",
    scope: q.scope ?? "mcp",
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-md">
            <ShieldCheck className="size-5" />
          </div>
          <H1>Allow access?</H1>
          <Lead className="text-base">
            <strong>{clientName}</strong> wants to connect to UDAMAN.
          </Lead>
        </div>

        <dl className="grid gap-3 rounded-md border p-4 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground text-xs">Signed in as</dt>
            <dd className="font-medium break-all">{email}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground text-xs">This will let it</dt>
            <dd>Read UHERO data as you through the UDAMAN MCP.</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground text-xs">
              After you decide, you&apos;ll be sent to
            </dt>
            <dd className="break-all">{redirectHost}</dd>
          </div>
        </dl>

        <p className="text-muted-foreground text-center text-xs">
          Only allow this if you started the connection yourself, for example by
          clicking Connect in Claude. If you got here from a link someone sent
          you, choose Deny.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <form action={denyConsent}>
            {Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" variant="outline" className="w-full">
              Deny
            </Button>
          </form>
          <form action={allowConsent}>
            {Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <Button type="submit" className="w-full">
              Allow
            </Button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
