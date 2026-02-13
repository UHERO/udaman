import { redirect } from "next/navigation";
import { auth } from ".";

/**
 * Get the current session and user, or null if not authenticated.
 * Use this in server components and server actions where auth is optional.
 */
export async function getSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}

/**
 * Require authentication. Redirects to /udaman if not authenticated.
 * Use this in server components and server actions that need a logged-in user.
 * Returns the session (never null).
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/udaman");
  return session;
}

/**
 * Get the current authenticated user's numeric ID.
 * Redirects to /udaman if not authenticated.
 * Drop-in async replacement for the old getCurrentUserId() stub.
 */
export async function getCurrentUserId(): Promise<number> {
  const session = await requireAuth();
  return parseInt(session.user!.id!);
}
