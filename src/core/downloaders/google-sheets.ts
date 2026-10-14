/**
 * Minimal Google Sheets v4 reader (values.get) with two ways to
 * authenticate, for sheets that are shared with specific accounts only:
 *
 *  1. Service account — share the sheet with the service account's email,
 *     then set GOOGLE_SERVICE_ACCOUNT_KEY_FILE (path to its JSON key) or
 *     GOOGLE_SERVICE_ACCOUNT_KEY (the JSON itself).
 *  2. OAuth refresh token for an account the sheet is shared with — set
 *     GOOGLE_SHEETS_REFRESH_TOKEN (mint one with
 *     `bun run downloaders google-auth`), plus GOOGLE_SHEETS_CLIENT_ID /
 *     GOOGLE_SHEETS_CLIENT_SECRET (default: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET,
 *     the app's sign-in OAuth client).
 *
 * Only the read-only Sheets scope is requested.
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export const SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cached: { token: string; expiresAt: number } | null = null;

function serviceAccountKey(): ServiceAccountKey | null {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (inline) return JSON.parse(inline) as ServiceAccountKey;
  if (file) return JSON.parse(readFileSync(file, "utf8")) as ServiceAccountKey;
  return null;
}

export function oauthClient(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_SHEETS_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
  const secret =
    process.env.GOOGLE_SHEETS_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
  return id && secret ? { id, secret } : null;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

async function postToken(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google token request failed: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim(),
    );
  }
  return json;
}

export async function getSheetsAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const sa = serviceAccountKey();
  let json;
  if (sa) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: SHEETS_SCOPE,
        aud: sa.token_uri ?? TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
    json = await postToken({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
  } else {
    const refresh = process.env.GOOGLE_SHEETS_REFRESH_TOKEN;
    const client = oauthClient();
    if (!refresh || !client) {
      throw new Error(
        "No Google Sheets credentials: set GOOGLE_SERVICE_ACCOUNT_KEY_FILE (service account the sheet is shared with) " +
          "or GOOGLE_SHEETS_REFRESH_TOKEN (run `bun run downloaders google-auth`).",
      );
    }
    json = await postToken({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: client.id,
      client_secret: client.secret,
    });
  }
  cached = {
    token: json.access_token!,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/**
 * values.get with unformatted values: numbers stay numbers, a real date
 * cell comes back as a serial day number, text stays text.
 */
export async function fetchSheetValues(
  sheetId: string,
  range: string,
): Promise<unknown[][]> {
  const token = await getSheetsAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}` +
    `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { values?: unknown[][] };
  return json.values ?? [];
}

/** Consent URL + code exchange for the google-auth CLI (refresh token). */
export function consentUrl(redirectUri: string): string {
  const client = oauthClient();
  if (!client)
    throw new Error(
      "Set GOOGLE_SHEETS_CLIENT_ID / _SECRET (or AUTH_GOOGLE_ID / _SECRET)",
    );
  const q = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SHEETS_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const client = oauthClient();
  if (!client)
    throw new Error(
      "Set GOOGLE_SHEETS_CLIENT_ID / _SECRET (or AUTH_GOOGLE_ID / _SECRET)",
    );
  const json = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.id,
    client_secret: client.secret,
  });
  if (!json.refresh_token) {
    throw new Error(
      "No refresh token returned (revoke the app's access and retry with prompt=consent)",
    );
  }
  return json.refresh_token;
}
