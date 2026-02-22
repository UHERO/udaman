const allowedEmails: string[] = ["wood2@hawaii.edu"];

const allowedDomains: string[] = ["hawaii.edu"];

/** When true, only allowedEmails is checked. When false, both lists are checked. */
const strictMode = false;

export function isEmailAllowed(email: string): boolean {
  const normalized = email.toLowerCase().trim();

  if (allowedEmails.includes(normalized)) return true;
  if (strictMode) return false;

  const domain = normalized.split("@")[1];
  return domain ? allowedDomains.includes(domain) : false;
}
