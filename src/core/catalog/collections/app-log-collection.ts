import { readFile } from "fs/promises";
import { resolve } from "path";

import { mysql, rawQuery } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("app-log-collection");

interface AppLogEntry {
  level?: "info" | "warn" | "error";
  category: string; // "page_view" | "action" | "error"
  name: string; // route path or action name
  userId?: number;
  metadata?: Record<string, unknown>;
}

export interface AppLogRow {
  id: number;
  level: "info" | "warn" | "error";
  category: string;
  name: string;
  userId: number | null;
  username: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export class AppLogCollection {
  /** Fire-and-forget write to app_logs. Never throws. */
  static async log(entry: AppLogEntry): Promise<void> {
    try {
      const level = entry.level ?? "info";
      const userId = entry.userId ?? null;
      const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;

      await mysql`
        INSERT INTO app_logs (level, category, name, user_id, metadata)
        VALUES (${level}, ${entry.category}, ${entry.name}, ${userId}, ${metadata})
      `;
    } catch (e) {
      log.error({ err: e, entry }, "Failed to write app_log");
    }
  }

  /** Query app_logs with optional filters and pagination. */
  static async list(opts: {
    level?: "info" | "warn" | "error";
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AppLogRow[]; total: number }> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.level) {
      conditions.push("al.level = ?");
      params.push(opts.level);
    }
    if (opts.category) {
      conditions.push("al.category = ?");
      params.push(opts.category);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countResult = await rawQuery(
      `SELECT COUNT(*) as total FROM app_logs al ${where}`,
      params as (string | number | Date)[],
    );
    const total = Number(countResult[0].total);

    // Data query with user join
    const rows = await rawQuery(
      `SELECT al.id, al.level, al.category, al.name, al.user_id, u.email as username,
              al.metadata, al.created_at
       FROM app_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset] as (string | number | Date)[],
    );

    const logs: AppLogRow[] = rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      level: r.level as "info" | "warn" | "error",
      category: r.category as string,
      name: r.name as string,
      userId: r.user_id != null ? Number(r.user_id) : null,
      username: (r.username as string) ?? null,
      metadata:
        typeof r.metadata === "string"
          ? JSON.parse(r.metadata)
          : (r.metadata as Record<string, unknown> | null),
      createdAt: new Date(r.created_at as string),
    }));

    return { logs, total };
  }

  /** Read the last N lines from the NDJSON log file. */
  static async readLogFile(opts?: { lines?: number }): Promise<string[]> {
    const maxLines = opts?.lines ?? 200;
    const logPath = resolve("logs/app-events.log");

    try {
      const content = await readFile(logPath, "utf-8");
      const allLines = content.split("\n").filter((l) => l.trim() !== "");
      // Return last N lines, newest first
      return allLines.slice(-maxLines).reverse();
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        "code" in e &&
        (e as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return [];
      }
      throw e;
    }
  }
}
