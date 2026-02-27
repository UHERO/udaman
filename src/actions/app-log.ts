"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";

/** Report a client-side error to the app_logs table. */
export async function reportClientError(payload: {
  message: string;
  digest?: string;
  pathname?: string;
}) {
  await AppLogCollection.log({
    level: "error",
    category: "error",
    name: payload.pathname ?? "unknown",
    metadata: {
      message: payload.message,
      digest: payload.digest,
    },
  });
}
