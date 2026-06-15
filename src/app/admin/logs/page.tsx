import { notFound } from "next/navigation";

import {
  getAppLogs,
  getLogCategories,
  getLogCounts,
  getLogFileEntries,
} from "@/actions/app-log";
import { listUsers } from "@/actions/users";
import { LogsPanel } from "@/components/admin/logs-panel";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function LogsPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const [dbResult, fileLines, categories, counts, users] = await Promise.all([
    getAppLogs({ limit: 50, offset: 0 }),
    getLogFileEntries({ lines: 200 }),
    getLogCategories(),
    getLogCounts(),
    listUsers(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-muted-foreground text-sm">
          Application database logs and server log file entries.
        </p>
      </div>
      <WidthToggleBar />

      <LogsPanel
        initialDbLogs={dbResult}
        initialFileLogs={fileLines}
        categories={categories}
        counts={counts}
        users={users.map((u) => ({ id: u.id, email: u.email }))}
      />
    </div>
  );
}
