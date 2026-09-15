"use server";

import {
  AppLogCollection,
  type AppLogCounts,
  type AppLogRow,
} from "@catalog/collections/app-log-collection";

import { getSession, requireAuth } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

/**
 * Normalize a browser pathname into the route we want to record.
 *
 * On the subdomain deployments the proxy rewrites `/uhero/series` to the
 * internal `/udaman/uhero/series`, so the browser never shows the `/udaman`
 * prefix — but hitting the app directly (localhost, or udaman.…/udaman/…)
 * does. Strip it so the same page produces one name in both environments.
 * Trailing slashes are dropped for the same reason.
 */
function normalizePathname(pathname: string): string {
  let path = pathname.split("?")[0].split("#")[0];
  if (path.startsWith("/udaman/")) path = path.slice("/udaman".length);
  else if (path === "/udaman") path = "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/**
 * Log a page view from the client. Fire-and-forget.
 *
 * The user is resolved from the session on the server — never trusted from the
 * caller — and anonymous views (login page, unauthenticated redirects) are
 * skipped so the table stays a record of who did what.
 */
export async function logPageViewAction(pathname: string) {
  if (!pathname || !pathname.startsWith("/")) return;

  const session = await getSession();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  if (!userId || Number.isNaN(userId)) return;

  await AppLogCollection.log({
    category: "page_view",
    name: normalizePathname(pathname),
    userId,
  });
}

/** Report a client-side error to the app_logs table. */
export async function reportClientError(payload: {
  message: string;
  digest?: string;
  pathname?: string;
  metadata?: Record<string, unknown>;
}) {
  await AppLogCollection.log({
    level: "error",
    category: "error",
    name: payload.pathname ?? "unknown",
    metadata: {
      message: payload.message,
      digest: payload.digest,
      ...payload.metadata,
    },
  });
}

/** Fetch paginated app_logs from the database. Requires dev role. */
export async function getAppLogs(opts: {
  level?: "info" | "warn" | "error";
  category?: string;
  userId?: number;
  name?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: SerializedAppLogRow[]; total: number }> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: dev role required");
  }

  const result = await AppLogCollection.list(opts);

  // Serialize Date objects for client transport
  return {
    logs: result.logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    total: result.total,
  };
}

/** Get distinct log categories. Requires dev role. */
export async function getLogCategories(): Promise<string[]> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: dev role required");
  }
  return AppLogCollection.getDistinctCategories();
}

/** Get aggregate log counts. Requires dev role. */
export async function getLogCounts(): Promise<AppLogCounts> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: dev role required");
  }
  return AppLogCollection.getCounts();
}

/** Read recent lines from the NDJSON server log file. Requires dev role. */
export async function getLogFileEntries(opts?: {
  lines?: number;
}): Promise<string[]> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: dev role required");
  }

  return AppLogCollection.readLogFile(opts);
}

export type SerializedAppLogRow = Omit<AppLogRow, "createdAt"> & {
  createdAt: string;
};
