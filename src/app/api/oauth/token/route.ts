/**
 * Token endpoint. Accepts application/x-www-form-urlencoded per RFC 6749.
 * Requires grant_type=authorization_code, code, code_verifier, client_id,
 * redirect_uri. Delegates to OAuthController.exchangeCode() and returns
 * { access_token, token_type: "Bearer", expires_in, scope } with
 * Cache-Control: no-store. Maps each OAuthError to the right HTTP status
 * (401 invalid_client, 500 server_error, 400 otherwise).
 */

import OAuthController, { type OAuthError } from "@catalog/controllers/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(req: Request) {
  // RFC 6749 specifies application/x-www-form-urlencoded for /token.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "body must be application/x-www-form-urlencoded",
      },
      { status: 400 },
    );
  }

  const grantType = asString(form.get("grant_type"));
  const code = asString(form.get("code"));
  const codeVerifier = asString(form.get("code_verifier"));
  const clientId = asString(form.get("client_id"));
  const redirectUri = asString(form.get("redirect_uri"));

  if (grantType !== "authorization_code") {
    return Response.json(
      {
        error: "unsupported_grant_type",
        error_description: "only authorization_code is supported",
      },
      { status: 400 },
    );
  }
  if (!code || !codeVerifier || !clientId || !redirectUri) {
    return Response.json(
      {
        error: "invalid_request",
        error_description:
          "code, code_verifier, client_id, and redirect_uri are required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await OAuthController.exchangeCode({
      code,
      codeVerifier,
      clientId,
      redirectUri,
    });
    return Response.json(
      {
        access_token: result.accessToken,
        token_type: "Bearer",
        expires_in: result.expiresIn,
        scope: result.scope,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      },
    );
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
    const status =
      oauthErr.error === "invalid_client"
        ? 401
        : oauthErr.error === "server_error"
          ? 500
          : 400;
    return Response.json(oauthErr, { status });
  }
}
