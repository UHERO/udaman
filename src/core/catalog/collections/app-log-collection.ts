import { readFile } from "fs/promises";
import { resolve } from "path";

import { mysql, rawQuery } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("app-log-collection");

interface AppLogEntry {
  level?: "info" | "warn" | "error";
  category: string;
  name: string;
  userId?: number;
  subject?: string;
  subjectId?: number;
  metadata?: Record<string, unknown>;
}

export interface AppLogRow {
  id: number;
  level: "info" | "warn" | "error";
  category: string;
  name: string;
  userId: number | null;
  username: string | null;
  subject: string | null;
  subjectId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AppLogCounts {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
}

export class AppLogCollection {
  /** Fire-and-forget write to app_logs. Never throws. */
  static async log(entry: AppLogEntry): Promise<void> {
    try {
      const level = entry.level ?? "info";
      const userId = entry.userId ?? null;
      const subject = entry.subject ?? null;
      const subjectId = entry.subjectId ?? null;
      const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;

      await mysql`
        INSERT INTO app_logs (level, category, name, user_id, subject, subject_id, metadata)
        VALUES (${level}, ${entry.category}, ${entry.name}, ${userId}, ${subject}, ${subjectId}, ${metadata})
      `;
    } catch (e) {
      log.error({ err: e, entry }, "Failed to write app_log");
    }
  }

  /**
   * Log an error to app_logs. Extracts structured info from HttpError
   * subclasses; falls back to category "error" for plain errors.
   * Fire-and-forget — never throws.
   */
  static logError(
    err: unknown,
    context?: { userId?: number; name?: string },
  ): void {
    const message = err instanceof Error ? err.message : String(err);
    // Duck-type check for HttpError properties to avoid importing @/lib/errors
    // (adding that import changes the module graph and breaks global-error prerender).
    const isHttp =
      err instanceof Error && "category" in err && "statusCode" in err;
    const httpErr = isHttp
      ? (err as Error & {
          category: string;
          statusCode: number;
          metadata?: Record<string, unknown>;
        })
      : null;

    AppLogCollection.log({
      level: "error",
      category: httpErr?.category ?? "error",
      name: context?.name ?? "unhandled_error",
      userId: context?.userId,
      metadata: {
        message,
        ...(httpErr && {
          statusCode: httpErr.statusCode,
          ...httpErr.metadata,
        }),
      },
    });
  }

  /** Query app_logs with optional filters and pagination. */
  static async list(opts: {
    level?: "info" | "warn" | "error";
    category?: string;
    userId?: number;
    name?: string;
    subject?: string;
    subjectId?: number;
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
    if (opts.userId) {
      conditions.push("al.user_id = ?");
      params.push(opts.userId);
    }
    if (opts.name) {
      conditions.push("al.name LIKE ?");
      params.push(`%${opts.name}%`);
    }
    if (opts.subject) {
      conditions.push("al.subject = ?");
      params.push(opts.subject);
    }
    if (opts.subjectId) {
      conditions.push("al.subject_id = ?");
      params.push(opts.subjectId);
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
              al.subject, al.subject_id, al.metadata, al.created_at
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
      subject: (r.subject as string) ?? null,
      subjectId: r.subject_id != null ? Number(r.subject_id) : null,
      metadata:
        typeof r.metadata === "string"
          ? JSON.parse(r.metadata)
          : (r.metadata as Record<string, unknown> | null),
      createdAt: new Date(r.created_at as string),
    }));

    return { logs, total };
  }

  /** Get distinct category values from app_logs. */
  static async getDistinctCategories(): Promise<string[]> {
    const rows = await rawQuery(
      `SELECT DISTINCT category FROM app_logs ORDER BY category`,
    );
    return rows.map((r: Record<string, unknown>) => r.category as string);
  }

  /** Get aggregate counts: total, by level, by category. */
  static async getCounts(): Promise<AppLogCounts> {
    const [totalRows, levelRows, categoryRows] = await Promise.all([
      rawQuery(`SELECT COUNT(*) as total FROM app_logs`),
      rawQuery(
        `SELECT level, COUNT(*) as cnt FROM app_logs GROUP BY level`,
      ),
      rawQuery(
        `SELECT category, COUNT(*) as cnt FROM app_logs GROUP BY category ORDER BY cnt DESC`,
      ),
    ]);

    const total = Number(totalRows[0].total);

    const byLevel: Record<string, number> = {};
    for (const r of levelRows) {
      byLevel[r.level as string] = Number(r.cnt);
    }

    const byCategory: Record<string, number> = {};
    for (const r of categoryRows) {
      byCategory[r.category as string] = Number(r.cnt);
    }

    return { total, byLevel, byCategory };
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
