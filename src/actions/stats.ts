"use server";

import { rawQuery } from "@database/mysql";
import { requireAuth } from "@/lib/auth/dal";

export type StatsData = {
  topPages: { path: string; views: number }[];
  topSeries: { seriesId: number; name: string; views: number }[];
  mostActiveUsers: { userId: number; username: string; views: number }[];
  topActions: { action: string; count: number }[];
  dailyActivity: { date: string; views: number }[];
};

export async function getStats(days = 30): Promise<StatsData> {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "dev") {
    throw new Error("Unauthorized");
  }

  const [topPages, topSeries, mostActiveUsers, topActions, dailyActivity] =
    await Promise.all([
      // 1. Top pages by view count
      rawQuery<{ path: string; views: number }>(
        `SELECT name AS path, COUNT(*) AS views
         FROM app_logs
         WHERE category = 'page_view'
           AND created_at >= NOW() - INTERVAL ? DAY
         GROUP BY name
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),

      // 2. Most viewed series — extract series ID from pathname, join series for name
      rawQuery<{ seriesId: number; name: string; views: number }>(
        `SELECT
           CAST(SUBSTRING_INDEX(a.name, '/', -1) AS UNSIGNED) AS seriesId,
           COALESCE(s.name, CONCAT('Series #', SUBSTRING_INDEX(a.name, '/', -1))) AS name,
           COUNT(*) AS views
         FROM app_logs a
         LEFT JOIN series s
           ON s.id = CAST(SUBSTRING_INDEX(a.name, '/', -1) AS UNSIGNED)
         WHERE a.category = 'page_view'
           AND a.name REGEXP '/series/[0-9]+$'
           AND a.created_at >= NOW() - INTERVAL ? DAY
         GROUP BY seriesId, name
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),

      // 3. Most active users
      rawQuery<{ userId: number; username: string; views: number }>(
        `SELECT
           a.user_id AS userId,
           COALESCE(SUBSTRING_INDEX(u.email, '@', 1), CONCAT('user:', a.user_id)) AS username,
           COUNT(*) AS views
         FROM app_logs a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.category = 'page_view'
           AND a.user_id IS NOT NULL
           AND a.created_at >= NOW() - INTERVAL ? DAY
         GROUP BY a.user_id, username
         ORDER BY views DESC
         LIMIT 20`,
        [days],
      ),

      // 4. Top actions (non-page-view)
      rawQuery<{ action: string; count: number }>(
        `SELECT name AS action, COUNT(*) AS count
         FROM app_logs
         WHERE category != 'page_view'
           AND created_at >= NOW() - INTERVAL ? DAY
         GROUP BY name
         ORDER BY count DESC
         LIMIT 20`,
        [days],
      ),

      // 5. Daily activity
      rawQuery<{ date: string; views: number }>(
        `SELECT DATE(created_at) AS date, COUNT(*) AS views
         FROM app_logs
         WHERE category = 'page_view'
           AND created_at >= NOW() - INTERVAL ? DAY
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [days],
      ),
    ]);

  return {
    topPages,
    topSeries: topSeries.map((r) => ({
      ...r,
      seriesId: Number(r.seriesId),
      views: Number(r.views),
    })),
    mostActiveUsers: mostActiveUsers.map((r) => ({
      ...r,
      userId: Number(r.userId),
      views: Number(r.views),
    })),
    topActions,
    dailyActivity: dailyActivity.map((r) => ({
      date: String(r.date),
      views: Number(r.views),
    })),
  };
}
