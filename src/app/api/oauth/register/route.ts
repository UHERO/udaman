/**
 * Dynamic Client Registration endpoint (RFC 7591). Accepts a JSON body with
 * `redirect_uris` and optional metadata. Validates input shape, defaults
 * grant/response types if not provided, and returns the issued `client_id`
 * plus the original metadata. Returns RFC-compliant `invalid_redirect_uri` /
 * `invalid_client_metadata` errors on bad input.
 */

import OAuthController from "@catalog/controllers/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterBody = {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  scope?: unknown;
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.some((v) => typeof v !== "string")) return null;
  return value as string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return Response.json(
      {
        error: "invalid_client_metadata",
        error_description: "request body must be JSON",
      },
      { status: 400 },
    );
  }

  const redirectUris = asStringArray(body.redirect_uris);
  if (!redirectUris || redirectUris.length === 0) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris must be a non-empty array of strings",
      },
      { status: 400 },
    );
  }

  try {
    const client = await OAuthController.registerClient({
      clientName: asString(body.client_name) ?? null,
      redirectUris,
      grantTypes: asStringArray(body.grant_types) ?? undefined,
      responseTypes: asStringArray(body.response_types) ?? undefined,
      tokenEndpointAuthMethod: asString(body.token_endpoint_auth_method),
      scope: asString(body.scope),
    });
    return Response.json(client.toRegistrationResponse(), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    if (message.startsWith("invalid_redirect_uri:")) {
      return Response.json(
        {
          error: "invalid_redirect_uri",
          error_description: message
            .slice("invalid_redirect_uri:".length)
            .trim(),
        },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "invalid_client_metadata", error_description: message },
      { status: 400 },
    );
  }
}
