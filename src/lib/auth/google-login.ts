/**
 * Which email addresses can sign in with the "UH Login" (Google) button.
 * Pure — safe for client components and scripts.
 *
 * hawaii.edu is a Google Workspace domain and gmail.com is Google itself, so
 * accounts on those domains need no password. Anything else has to use the
 * email + password form, so a password must be set when the account is
 * created (UserCollection.create enforces this).
 */

export const GOOGLE_LOGIN_DOMAINS = ["gmail.com", "hawaii.edu"] as const;

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function canUseGoogleLogin(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return GOOGLE_LOGIN_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
}

/** Label for form hints: why a password is or isn't required for `email`. */
export function passwordRequirementHint(email: string): string {
  if (!emailDomain(email))
    return "Only required for non UH, or non Gmail accounts.";
  return canUseGoogleLogin(email)
    ? "Optional — this email can sign in with UH Login."
    : "Required — this email can't use UH Login, so it must use email and password.";
}
