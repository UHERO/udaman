import type { UploadConfig } from "./universe-upload";

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

/** Periodically remove expired sessions */
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
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
