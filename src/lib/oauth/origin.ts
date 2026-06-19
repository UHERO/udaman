/**
 * Resolve the public-facing origin from a request. Behind a reverse proxy
 * (nginx → localhost:3008), `new URL(req.url).origin` returns the internal
 * address. This helper reads the standard forwarded headers instead.
 */
export function getPublicOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
