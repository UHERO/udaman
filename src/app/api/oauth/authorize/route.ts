/**
 * Authorization endpoint. Validates query params and confirms the client is
 * registered with this redirect_uri, then checks NextAuth for a signed-in
 * user. If not signed in, redirects to /udaman with a `callbackUrl` that
 * brings them back here after login. If signed in, it does NOT issue a code:
 * it forwards the request (same query string) to the consent page at
 * /oauth/consent, where the user must explicitly click Allow. The code is
 * issued by the consent page's server action (src/actions/oauth-consent.ts).
 *
 * That pause is what stops a one-click token grab: registration is open, so
 * anyone can mint a client with their own redirect_uri and link a signed-in
 * user here. Without consent, the code would be issued and handed over
 * silently.
 *
 * Implements RFC 6749 §4.1.2.1 error redirects when client/URI are valid, and
 * JSON errors when they aren't (so we don't become an open redirector).
 */

import OAuthClientCollection from "@catalog/collections/oauth-client-collection";
import { type OAuthError } from "@catalog/controllers/oauth";

import { auth } from "@/lib/auth/index";
import { getPublicOrigin } from "@/lib/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Build a redirect URL that includes the `error`, `error_description`, and
 * `state` per RFC 6749 §4.1.2.1. Only used once the redirect_uri has been
 * verified against the registered client.
 */
function errorRedirect(
  redirectUri: string,
  state: string | null,
  err: OAuthError,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", err.error);
  if (err.error_description)
    url.searchParams.set("error_description", err.error_description);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const state = url.searchParams.get("state");

  // Hard input validation — error must NOT redirect if redirect_uri or
  // client_id is missing/unverified (per RFC 6749), since that could turn
  // /authorize into an open redirector.
  if (!clientId || !redirectUri) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "client_id and redirect_uri are required",
      },
      { status: 400 },
    );
  }

  const client = await OAuthClientCollection.getByClientId(clientId);
  if (!client) {
    return Response.json(
      { error: "invalid_client", error_description: "unknown client_id" },
      { status: 400 },
    );
  }
  if (!client.redirectUriAllowed(redirectUri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri not registered for this client",
      },
      { status: 400 },
    );
  }

  // From here on the redirect_uri is trusted, so protocol errors go back to
  // the client per the RFC.
  if (responseType !== "code") {
    return errorRedirect(redirectUri, state, {
      error: "invalid_request",
      error_description: "response_type must be 'code'",
    });
  }

  const origin = getPublicOrigin(req);

  // Require sign-in. If not signed in, redirect to NextAuth sign-in with a
  // callbackUrl that brings us right back here.
  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = url.pathname + url.search;
    const signInUrl = new URL("/udaman", origin);
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(signInUrl.toString(), 302);
  }

  // Signed in: hand off to the consent page with the same query string. The
  // PKCE fields are validated there by OAuthController.authorize on Allow.
  const consentUrl = new URL("/oauth/consent", origin);
  consentUrl.search = url.search;
  return Response.redirect(consentUrl.toString(), 302);
}
