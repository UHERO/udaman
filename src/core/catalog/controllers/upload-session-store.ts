import {
  DbedtUploadCollection,
  DvwUploadCollection,
} from "@catalog/collections/universe-upload-collection";

import { createLogger } from "@/core/observability/logger";

import type { UploadConfig } from "./universe-upload";

const log = createLogger("upload-session-store");

export type UploadSession = {
  uploadId: number;
  config: UploadConfig;
  /** DVW: DvwDimensionMaps; DBEDT: Map<number, DbedtMetaRow> */
  metaContext: unknown;
  /** Only used by DBEDT (DVW inserts per-chunk) */
  accumulatedRows: unknown[];
  totalInserted: number;
  createdAt: number;
};

const sessions = new Map<number, UploadSession>();

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Periodically remove expired sessions and clean up stale DB records */
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      // Mark the upload as failed in the DB (fire-and-forget)
      session.config.uploadCollection
        .updateStatus(id, "fail", "Upload timed out")
        .catch((e) =>
          log.error({ uploadId: id, err: e }, "Failed to mark expired upload"),
        );
    }
  }

  // Catch-all: mark any DB records stuck in "processing" for over 2 hours
  DbedtUploadCollection.failStaleUploads().catch((e) =>
    log.error({ err: e }, "DBEDT stale upload cleanup failed"),
  );
  DvwUploadCollection.failStaleUploads().catch((e) =>
    log.error({ err: e }, "DVW stale upload cleanup failed"),
  );
}, CLEANUP_INTERVAL_MS);

export function createSession(
  uploadId: number,
  config: UploadConfig,
  metaContext: unknown,
): UploadSession {
  const session: UploadSession = {
    uploadId,
    config,
    metaContext,
    accumulatedRows: [],
    totalInserted: 0,
    createdAt: Date.now(),
  };
  sessions.set(uploadId, session);
  return session;
}

export function getSession(uploadId: number): UploadSession | undefined {
  return sessions.get(uploadId);
}

export function deleteSession(uploadId: number): void {
  sessions.delete(uploadId);
}
