/**
 * Authorization endpoint. Validates query params, then checks NextAuth for a
 * signed-in user. If not signed in, redirects to /udaman with a `callbackUrl`
 * that brings them back here after login. On success, issues a one-time code
 * and redirects to the client's `redirect_uri` with `code` + `state`.
 * Implements RFC 6749 §4.1.2.1 error redirects when client/URI are valid, and
 * JSON errors when they aren't (so we don't become an open redirector).
 */

import OAuthController, { type OAuthError } from "@catalog/controllers/oauth";

import { auth } from "@/lib/auth/index";
import { getPublicOrigin } from "@/lib/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Build a redirect URL that includes the `error`, `error_description`, and
 * `state` per RFC 6749 §4.1.2.1. Falls back to a plain 400 if we don't have
 * a valid redirect target (e.g. unknown client).
 */
function errorRedirect(
  redirectUri: string | null,
  state: string | null,
  err: OAuthError,
): Response {
  if (!redirectUri) {
    return Response.json(err, { status: 400 });
  }
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
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") ?? "mcp";

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
  if (responseType !== "code") {
    return errorRedirect(redirectUri, state, {
      error: "invalid_request",
      error_description: "response_type must be 'code'",
    });
  }

  // Require sign-in. If not signed in, redirect to NextAuth sign-in with a
  // callbackUrl that brings us right back here.
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    const callbackUrl = url.pathname + url.search;
    const signInUrl = new URL("/udaman", getPublicOrigin(req));
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(signInUrl.toString(), 302);
  }

  try {
    const { code, redirectTo } = await OAuthController.authorize({
      clientId,
      redirectUri,
      codeChallenge: codeChallenge ?? "",
      codeChallengeMethod: codeChallengeMethod ?? "",
      scope,
      userId: Number(session.user.id),
      userEmail: session.user.email,
    });
    const target = new URL(redirectTo);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    return Response.redirect(target.toString(), 302);
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
    // For invalid_client / invalid_request that came from un-trusted inputs,
    // don't redirect — return JSON instead.
    if (
      oauthErr.error === "invalid_client" ||
      oauthErr.error === "invalid_request"
    ) {
      return Response.json(oauthErr, { status: 400 });
    }
    return errorRedirect(redirectUri, state, oauthErr);
  }
}
