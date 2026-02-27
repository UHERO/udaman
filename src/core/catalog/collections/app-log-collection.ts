import { createLogger } from "@/core/observability/logger";
import { mysql } from "@database/mysql";

const log = createLogger("app-log-collection");

interface AppLogEntry {
  level?: "info" | "warn" | "error";
  category: string; // "page_view" | "action" | "error"
  name: string; // route path or action name
  userId?: number;
  metadata?: Record<string, unknown>;
}

export class AppLogCollection {
  /** Fire-and-forget write to app_logs. Never throws. */
  static async log(entry: AppLogEntry): Promise<void> {
    try {
      const level = entry.level ?? "info";
      const userId = entry.userId ?? null;
      const metadata = entry.metadata
        ? JSON.stringify(entry.metadata)
        : null;

      await mysql`
        INSERT INTO app_logs (level, category, name, user_id, metadata)
        VALUES (${level}, ${entry.category}, ${entry.name}, ${userId}, ${metadata})
      `;
    } catch (e) {
      log.error({ err: e, entry }, "Failed to write app_log");
    }
  }
}
