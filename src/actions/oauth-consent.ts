"use server";

/**
 * Server actions behind the OAuth consent page (/oauth/consent). The
 * authorize endpoint no longer issues a code on its own — it parks the
 * request here so the signed-in user sees which client wants access and
 * must click Allow. Server actions carry Next.js's Origin-header CSRF check,
 * so a cross-site link can't trigger Allow on the user's behalf.
 *
 *   - allowConsent(formData) : re-validates the session, client, and
 *                              redirect_uri, then issues the code via
 *                              OAuthController.authorize and redirects to the
 *                              client with `code` + `state`
 *   - denyConsent(formData)  : redirects to the client with
 *                              `error=access_denied` + `state`
 *
 * Both re-check that `redirect_uri` is registered for the client before
 * redirecting anywhere, so the form fields are never trusted on their own.
 */
import { redirect } from "next/navigation";
import OAuthClientCollection from "@catalog/collections/oauth-client-collection";
import OAuthController, { type OAuthError } from "@catalog/controllers/oauth";

import { auth } from "@/lib/auth/index";

export type ConsentParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string | null;
  scope: string;
};

function field(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Pull the OAuth params back out of the consent form's hidden fields. Not
 * exported: every export of a "use server" module becomes a callable action.
 */
function readConsentParams(formData: FormData): ConsentParams | null {
  const clientId = field(formData, "client_id");
  const redirectUri = field(formData, "redirect_uri");
  if (!clientId || !redirectUri) return null;
  return {
    clientId,
    redirectUri,
    codeChallenge: field(formData, "code_challenge") ?? "",
    codeChallengeMethod: field(formData, "code_challenge_method") ?? "",
    state: field(formData, "state"),
    scope: field(formData, "scope") ?? "mcp",
  };
}

/** Where to send the user back to the authorize flow after signing in. */
function authorizeUrl(p: ConsentParams): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    code_challenge: p.codeChallenge,
    code_challenge_method: p.codeChallengeMethod,
    scope: p.scope,
  });
  if (p.state) q.set("state", p.state);
  return `/api/oauth/authorize?${q.toString()}`;
}

/** Consent page URL that renders a terminal error instead of the form. */
function consentErrorUrl(error: OAuthError["error"]): string {
  return `/oauth/consent?error=${encodeURIComponent(error)}`;
}

/**
 * Build the RFC 6749 §4.1.2.1 error redirect back to the client. Only call
 * this with a redirect_uri that has been checked against the client.
 */
function clientErrorUrl(
  redirectUri: string,
  state: string | null,
  err: OAuthError,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", err.error);
  if (err.error_description)
    url.searchParams.set("error_description", err.error_description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Confirm the client exists and the redirect_uri is registered for it.
 * Returns the consent-page error URL to redirect to when either fails.
 */
async function verifyClient(p: ConsentParams): Promise<string | null> {
  const client = await OAuthClientCollection.getByClientId(p.clientId);
  if (!client) return consentErrorUrl("invalid_client");
  if (!client.redirectUriAllowed(p.redirectUri))
    return consentErrorUrl("invalid_request");
  return null;
}

export async function allowConsent(formData: FormData): Promise<void> {
  const p = readConsentParams(formData);
  if (!p) redirect(consentErrorUrl("invalid_request"));

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/udaman?callbackUrl=${encodeURIComponent(authorizeUrl(p))}`);
  }

  const bad = await verifyClient(p);
  if (bad) redirect(bad);

  // Compute the destination inside try/catch, then redirect outside it —
  // redirect() throws, and catching it would swallow the navigation.
  let target: string;
  try {
    const { code, redirectTo } = await OAuthController.authorize({
      clientId: p.clientId,
      redirectUri: p.redirectUri,
      codeChallenge: p.codeChallenge,
      codeChallengeMethod: p.codeChallengeMethod,
      scope: p.scope,
      userId: Number(session.user.id),
    });
    const url = new URL(redirectTo);
    url.searchParams.set("code", code);
    if (p.state) url.searchParams.set("state", p.state);
    target = url.toString();
  } catch (err) {
    const oauthErr =
      err &&
      typeof err === "object" &&
      "error" in (err as Record<string, unknown>)
        ? (err as OAuthError)
        : ({
            error: "server_error",
            error_description: "internal error",
          } as OAuthError);
    // Client/request problems don't get a redirect to the (untrusted) client.
    target =
      oauthErr.error === "invalid_client" ||
      oauthErr.error === "invalid_request"
        ? consentErrorUrl(oauthErr.error)
        : clientErrorUrl(p.redirectUri, p.state, oauthErr);
  }
  redirect(target);
}

export async function denyConsent(formData: FormData): Promise<void> {
  const p = readConsentParams(formData);
  if (!p) redirect(consentErrorUrl("invalid_request"));

  const session = await auth();
  if (!session?.user?.id) redirect("/udaman");

  const bad = await verifyClient(p);
  if (bad) redirect(bad);

  redirect(
    clientErrorUrl(p.redirectUri, p.state, {
      error: "access_denied",
      error_description: "the user declined the request",
    }),
  );
}
