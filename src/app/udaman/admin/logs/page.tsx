import { notFound } from "next/navigation";

import { getAppLogs, getLogFileEntries } from "@/actions/app-log";
import { LogsPanel } from "@/components/admin/logs-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function LogsPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const [dbResult, fileLines] = await Promise.all([
    getAppLogs({ limit: 50, offset: 0 }),
    getLogFileEntries({ lines: 200 }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-muted-foreground text-sm">
          Application database logs and server log file entries.
        </p>
      </div>

      <LogsPanel initialDbLogs={dbResult} initialFileLogs={fileLines} />
    </div>
  );
}
