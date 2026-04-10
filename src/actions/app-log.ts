"use server";

import {
  AppLogCollection,
  type AppLogCounts,
  type AppLogRow,
} from "@catalog/collections/app-log-collection";

import { requireAuth } from "@/lib/auth/dal";

/** Log a page view from the client. Fire-and-forget. */
export async function logPageViewAction(pathname: string, userId?: number) {
  AppLogCollection.log({
    category: "page_view",
    name: pathname,
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
    throw new Error("Unauthorized");
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
    throw new Error("Unauthorized");
  }
  return AppLogCollection.getDistinctCategories();
}

/** Get aggregate log counts. Requires dev role. */
export async function getLogCounts(): Promise<AppLogCounts> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new Error("Unauthorized");
  }
  return AppLogCollection.getCounts();
}

/** Read recent lines from the NDJSON server log file. Requires dev role. */
export async function getLogFileEntries(opts?: {
  lines?: number;
}): Promise<string[]> {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    throw new Error("Unauthorized");
  }

  return AppLogCollection.readLogFile(opts);
}

export type SerializedAppLogRow = Omit<AppLogRow, "createdAt"> & {
  createdAt: string;
};
