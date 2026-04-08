"use server";

import {
  AppLogCollection,
  type AppLogRow,
} from "@catalog/collections/app-log-collection";

import { requireAuth } from "@/lib/auth/dal";

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
