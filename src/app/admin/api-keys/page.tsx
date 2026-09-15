import { notFound } from "next/navigation";

import { listApiApplications } from "@/actions/api-applications";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { WidthToggleBar } from "@/components/width-toggle-bar";
import { requireAuth } from "@/lib/auth/dal";

export default async function ApiKeysPage() {
  const session = await requireAuth();
  if (session.user.role !== "dev") {
    notFound();
  }

  const apiKeys = await listApiApplications();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground text-sm">
          Manage API applications and their access keys.
        </p>
      </div>
      <WidthToggleBar />

      <ApiKeysPanel data={apiKeys} />
    </div>
  );
}
