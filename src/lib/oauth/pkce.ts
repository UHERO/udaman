/**
 * Crypto utilities for the OAuth layer:
 *   - sha256Hex(input)             : hashes codes and tokens before DB storage
 *   - sha256Base64Url(input)       : computes the expected PKCE challenge
 *                                    from a verifier
 *   - randomBase64Url(bytes)       : generates client IDs, codes, and tokens
 *   - verifyPkceChallenge(verifier, challenge, method)
 *                                  : validates code_verifier against
 *                                    code_challenge with timingSafeEqual.
 *                                    Rejects anything other than S256 and
 *                                    enforces RFC 7636 verifier syntax.
 */

import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PKCE_VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest().toString("base64url");
}

export function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type PkceVerificationResult =
  | { ok: true }
  | { ok: false; reason: "bad_method" | "bad_verifier" | "mismatch" };

export function verifyPkceChallenge(
  verifier: string,
  challenge: string,
  method: string,
): PkceVerificationResult {
  if (method !== "S256") return { ok: false, reason: "bad_method" };
  if (!PKCE_VERIFIER_RE.test(verifier))
    return { ok: false, reason: "bad_verifier" };

  const expected = sha256Base64Url(verifier);
  if (expected.length !== challenge.length)
    return { ok: false, reason: "mismatch" };

  const expectedBuf = Buffer.from(expected);
  const challengeBuf = Buffer.from(challenge);
  if (!timingSafeEqual(expectedBuf, challengeBuf)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}
